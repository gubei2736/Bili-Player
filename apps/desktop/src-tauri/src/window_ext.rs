use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[cfg(target_os = "windows")]
pub mod win32_theme {
    extern "system" {
        fn LoadLibraryA(lpLibFileName: *const u8) -> *mut std::ffi::c_void;
        fn GetProcAddress(
            hModule: *mut std::ffi::c_void,
            lpProcName: *const u8,
        ) -> *mut std::ffi::c_void;
        fn FreeLibrary(hLibModule: *mut std::ffi::c_void) -> i32;
    }

    /// Enable native Dark Mode for all Win32 menus (including system tray menu)
    pub fn enable_windows_dark_mode() {
        unsafe {
            let uxtheme = LoadLibraryA(b"uxtheme.dll\0".as_ptr());
            if !uxtheme.is_null() {
                // Ordinal 135: SetPreferredAppMode (0 = Default, 1 = AllowDark, 2 = ForceDark)
                let set_mode_ptr = GetProcAddress(uxtheme, 135 as usize as *const u8);
                if !set_mode_ptr.is_null() {
                    let set_mode: unsafe extern "system" fn(i32) -> i32 =
                        std::mem::transmute(set_mode_ptr);
                    let _ = set_mode(2); // ForceDark
                } else {
                    // Fallback to Ordinal 133: AllowDarkModeForApp
                    let allow_dark_ptr = GetProcAddress(uxtheme, 133 as usize as *const u8);
                    if !allow_dark_ptr.is_null() {
                        let allow: unsafe extern "system" fn(bool) -> bool =
                            std::mem::transmute(allow_dark_ptr);
                        let _ = allow(true);
                    }
                }

                // Ordinal 136: FlushMenuThemes
                let flush_ptr = GetProcAddress(uxtheme, 136 as usize as *const u8);
                if !flush_ptr.is_null() {
                    let flush: unsafe extern "system" fn() = std::mem::transmute(flush_ptr);
                    flush();
                }

                FreeLibrary(uxtheme);
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn enable_windows_dark_mode() {
    win32_theme::enable_windows_dark_mode();
}

#[cfg(target_os = "windows")]
pub fn get_cursor_pos() -> (i32, i32) {
    unsafe {
        #[repr(C)]
        struct POINT {
            x: i32,
            y: i32,
        }
        extern "system" {
            fn GetCursorPos(lpPoint: *mut POINT) -> i32;
        }
        let mut pt = POINT { x: 0, y: 0 };
        GetCursorPos(&mut pt);
        (pt.x, pt.y)
    }
}

/// Configure lyrics window to be completely borderless with no shadow
pub fn setup_lyrics_window(window: &WebviewWindow) {
    let _ = window.set_shadow(false);
}

/// Apply native window effects (Shadow, Win11 Mica, macOS Vibrancy)
pub fn setup_window_effects(window: &WebviewWindow) {
    // 1. Set window shadow (Tauri v2 native method)
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let _ = window.set_shadow(true);
    }

    // 2. Set Mica / Acrylic on Windows
    #[cfg(target_os = "windows")]
    {
        // Try Windows 11 Mica first (dark mode = true)
        let _ = window_vibrancy::apply_mica(window, Some(true));
    }

    let _ = window.show();
    let _ = window.set_focus();

    // 3. Set Vibrancy on macOS
    #[cfg(target_os = "macos")]
    {
        let _ = window_vibrancy::apply_vibrancy(
            window,
            window_vibrancy::NSVisualEffectMaterial::Sidebar,
            None,
            None,
        );
    }
}

/// Tauri Command: Check if app is running in debug mode
#[tauri::command]
pub fn is_debug_mode() -> bool {
    cfg!(debug_assertions)
}

/// Tauri Command: Set ignore cursor events (mouse penetration) for lyrics window
#[tauri::command]
pub fn set_ignore_cursor_events(
    app: AppHandle,
    window: WebviewWindow,
    ignore: bool,
) -> Result<(), String> {
    crate::shortcuts::LYRICS_IGNORE_CURSOR.store(ignore, Ordering::SeqCst);
    setup_lyrics_window(&window);
    let _ = app.emit("lyrics-lock-change", ignore);
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

/// Tauri Command: Toggle lyrics window mouse penetration lock
#[tauri::command]
pub fn toggle_lyrics_lock(app: AppHandle) -> Result<bool, String> {
    let new_state = !crate::shortcuts::LYRICS_IGNORE_CURSOR.load(Ordering::SeqCst);
    crate::shortcuts::LYRICS_IGNORE_CURSOR.store(new_state, Ordering::SeqCst);
    if let Some(lyrics_win) = app.get_webview_window("lyrics") {
        setup_lyrics_window(&lyrics_win);
        // 如果用户在歌词窗口未显示时右键锁定，自动先显示歌词窗口，防止“隐式盲锁”
        if let Ok(false) = lyrics_win.is_visible() {
            let _ = lyrics_win.show();
            let _ = app.emit("lyrics-visibility-change", true);
            let _ = app.emit("lyrics-request-initial-sync", ());
        }
        let _ = lyrics_win.set_ignore_cursor_events(new_state);
    }
    let _ = app.emit("lyrics-lock-change", new_state);
    Ok(new_state)
}

/// Tauri Command: Show or hide lyrics window without stealing OS focus from fullscreen games/apps
#[tauri::command]
pub fn toggle_lyrics_window(app: AppHandle) -> Result<bool, String> {
    if let Some(lyrics_win) = app.get_webview_window("lyrics") {
        let is_visible = lyrics_win.is_visible().map_err(|e| e.to_string())?;
        if is_visible {
            lyrics_win.hide().map_err(|e| e.to_string())?;
            let _ = app.emit("lyrics-visibility-change", false);
            Ok(false)
        } else {
            lyrics_win.show().map_err(|e| e.to_string())?;

            // 重新确保穿透状态在窗口重新 show() 后依然生效，且不调用 set_focus() 避免打断用户当前全屏应用
            let is_locked = crate::shortcuts::LYRICS_IGNORE_CURSOR.load(Ordering::SeqCst);
            setup_lyrics_window(&lyrics_win);
            let _ = lyrics_win.set_ignore_cursor_events(is_locked);
            let _ = app.emit("lyrics-visibility-change", true);
            let _ = app.emit("lyrics-lock-change", is_locked);
            let _ = app.emit("lyrics-request-initial-sync", ());

            Ok(true)
        }
    } else {
        Err("Lyrics window not found".to_string())
    }
}

/// Tauri Command: Completely exit the application and clean up tray icon
#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

/// Tauri Command: Append debug log message directly to disk (active only in debug mode)
#[tauri::command]
pub fn append_debug_log(message: String) {
    #[cfg(debug_assertions)]
    {
        use std::fs::OpenOptions;
        use std::io::Write;
        if let Ok(mut path) = std::env::temp_dir().into_os_string().into_string() {
            path.push_str("\\bbplayer_debug.log");
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
                let _ = writeln!(file, "{}", message);
            }
        }
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = message;
    }
}

/// Tauri Command: Check if lyrics window is currently in locked (mouse penetration) state
#[tauri::command]
pub fn is_lyrics_locked() -> bool {
    crate::shortcuts::LYRICS_IGNORE_CURSOR.load(Ordering::SeqCst)
}

/// Tauri Command: Toggle Mini Player mode (hide main, show mini or vice versa)
#[tauri::command]
pub fn toggle_mini_player(app: AppHandle) -> Result<bool, String> {
    if let (Some(main_win), Some(mini_win)) = (
        app.get_webview_window("main"),
        app.get_webview_window("mini"),
    ) {
        let is_mini_visible = mini_win.is_visible().unwrap_or(false);
        if is_mini_visible {
            let _ = mini_win.hide();
            let _ = main_win.show();
            let _ = main_win.set_focus();
            let _ = app.emit("mini-player-visibility-change", false);
            Ok(false)
        } else {
            let _ = main_win.hide();
            let _ = mini_win.show();
            let _ = mini_win.set_focus();
            let _ = app.emit("mini-player-visibility-change", true);
            let _ = app.emit("mini-player-request-sync", ());
            Ok(true)
        }
    } else {
        Err("Window not found".to_string())
    }
}

/// Tauri Command: Restore main window from Mini Player
#[tauri::command]
pub fn restore_main_from_mini(app: AppHandle) -> Result<(), String> {
    if let (Some(main_win), Some(mini_win)) = (
        app.get_webview_window("main"),
        app.get_webview_window("mini"),
    ) {
        let _ = mini_win.hide();
        let _ = main_win.show();
        let _ = main_win.set_focus();
        let _ = app.emit("mini-player-visibility-change", false);
    }
    Ok(())
}

/// Tauri Command: Show or hide the custom rounded-corner Tray Menu window near mouse
#[tauri::command]
pub fn show_tray_menu(app: AppHandle) -> Result<(), String> {
    if let Some(tray_win) = app.get_webview_window("tray_menu") {
        let is_visible = tray_win.is_visible().unwrap_or(false);
        if is_visible {
            let _ = tray_win.hide();
            return Ok(());
        }

        #[cfg(target_os = "windows")]
        {
            let (cx, cy) = get_cursor_pos();
            let win_w = 210;
            let win_h = 330;
            let x = (cx - win_w / 2).max(10);
            let y = (cy - win_h - 8).max(10);
            let _ = tray_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }

        let _ = tray_win.show();
        let _ = tray_win.set_focus();
    }
    Ok(())
}

/// Tauri Command: Trigger playback actions from mini player / tray (play_pause, prev_track, next_track)
#[tauri::command]
pub fn trigger_player_action(app: AppHandle, action: String) {
    let _ = app.emit("global-shortcut-event", &action);
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("global-shortcut-event", &action);
        if let Ok(json_id) = serde_json::to_string(&action) {
            let script = format!(
                "if (typeof window.__triggerGlobalShortcut === 'function') {{ window.__triggerGlobalShortcut({}); }}",
                json_id
            );
            let _ = main_win.eval(&script);
        }
    }
}

/// Tauri Command: Seek player progress from mini player / UI
#[tauri::command]
pub fn player_seek(app: AppHandle, position: f64) {
    let _ = app.emit("player-seek", position);
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("player-seek", position);
        let script = format!(
            "if (typeof window.__bbplayer_seek === 'function') {{ window.__bbplayer_seek({}); }}",
            position
        );
        let _ = main_win.eval(&script);
    }
}

/// Tauri Command: Toggle player mute state
#[tauri::command]
pub fn player_toggle_mute(app: AppHandle) {
    let _ = app.emit("player-toggle-mute", ());
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("player-toggle-mute", ());
        let _ = main_win.eval("if (typeof window.__bbplayer_toggle_mute === 'function') { window.__bbplayer_toggle_mute(); }");
    }
}

/// Tauri Command: Toggle player repeat/shuffle mode
#[tauri::command]
pub fn player_toggle_mode(app: AppHandle) {
    let _ = app.emit("player-toggle-mode", ());
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("player-toggle-mode", ());
        let _ = main_win.eval("if (typeof window.__bbplayer_toggle_mode === 'function') { window.__bbplayer_toggle_mode(); }");
    }
}

/// Tauri Command: Request full player state sync to mini player
#[tauri::command]
pub fn player_request_sync(app: AppHandle) {
    let _ = app.emit("mini-player-request-sync", ());
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("mini-player-request-sync", ());
        let _ = main_win.eval("if (typeof window.__bbplayer_broadcast_state === 'function') { window.__bbplayer_broadcast_state(); }");
    }
}
