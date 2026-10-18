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

pub fn get_log_file_path() -> std::path::PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let path = parent.join("bili_player_debug.log");
            if std::fs::OpenOptions::new().create(true).write(true).open(&path).is_ok() {
                return path;
            }
        }
    }
    std::env::temp_dir().join("bili_player_debug.log")
}

pub fn write_log_line(message: &str) {
    #[cfg(debug_assertions)]
    {
        eprintln!("{}", message);
        use std::fs::OpenOptions;
        use std::io::Write;
        let path = get_log_file_path();
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(file, "{}", message);
        }
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = message;
    }
}

/// Tauri Command: Append debug log message directly to console and disk (active only in debug mode)
#[tauri::command]
pub fn append_debug_log(message: String) {
    write_log_line(&format!("[UI] {}", message));
}

/// Tauri Command: Get current debug log file absolute path
#[tauri::command]
pub fn get_debug_log_path() -> String {
    get_log_file_path().to_string_lossy().to_string()
}

/// Tauri Command: Open debug log file with system default editor
#[tauri::command]
pub fn open_debug_log_file() {
    let path = get_log_file_path();
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("notepad.exe")
            .arg(&path)
            .spawn();
    }
}

/// Tauri Command: Open external URL with system default web browser
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(&["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(())
    }
}

/// Tauri Command: Toggle DevTools on the main window (F12 or debug helper)
#[tauri::command]
pub fn toggle_devtools(_app: AppHandle) {
    #[cfg(debug_assertions)]
    if let Some(win) = _app.get_webview_window("main") {
        if win.is_devtools_open() {
            win.close_devtools();
        } else {
            win.open_devtools();
        }
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
            let scale_factor = tray_win.scale_factor().unwrap_or(1.0);
            let phys_size = tray_win.outer_size().unwrap_or_else(|_| {
                tauri::PhysicalSize {
                    width: (210.0 * scale_factor) as u32,
                    height: (360.0 * scale_factor) as u32,
                }
            });
            let phys_w = phys_size.width as i32;
            let phys_h = phys_size.height as i32;

            let mut x = cx - phys_w / 2;
            let mut y = cy - phys_h - 12;

            if let Ok(Some(monitor)) = tray_win.current_monitor() {
                let m_pos = monitor.position();
                let m_size = monitor.size();
                let min_x = m_pos.x + 10;
                let max_x = m_pos.x + m_size.width as i32 - phys_w - 10;
                let min_y = m_pos.y + 10;
                let max_y = m_pos.y + m_size.height as i32 - phys_h - 10;

                x = x.clamp(min_x, max_x);
                y = y.clamp(min_y, max_y);
            } else {
                x = x.max(10);
                y = y.max(10);
            }

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
    if let Some(main_win) = app.get_webview_window("main") {
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
    if let Some(main_win) = app.get_webview_window("main") {
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
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.eval("if (typeof window.__bbplayer_toggle_mute === 'function') { window.__bbplayer_toggle_mute(); }");
    }
}

/// Tauri Command: Toggle player repeat/shuffle mode
#[tauri::command]
pub fn player_toggle_mode(app: AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.eval("if (typeof window.__bbplayer_toggle_mode === 'function') { window.__bbplayer_toggle_mode(); }");
    }
}

/// Tauri Command: Request full player state sync to mini player
#[tauri::command]
pub fn player_request_sync(app: AppHandle) {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.eval("if (typeof window.__bbplayer_broadcast_state === 'function') { window.__bbplayer_broadcast_state(); }");
    }
}

/// Tauri Command: Expand or collapse the mini player window size (e.g., 94px to 380px)
#[tauri::command]
pub fn set_mini_player_expanded(app: AppHandle, expanded: bool) -> Result<(), String> {
    if let Some(mini_win) = app.get_webview_window("mini") {
        let target_h = if expanded { 380.0 } else { 94.0 };
        let target_w = 390.0;

        // 检查位置以防窗口展开时超出屏幕下边缘
        if expanded {
            if let (Ok(Some(monitor)), Ok(pos), Ok(scale)) = (
                mini_win.current_monitor(),
                mini_win.outer_position(),
                mini_win.scale_factor(),
            ) {
                let m_pos = monitor.position();
                let m_size = monitor.size();
                let max_phys_y = m_pos.y + m_size.height as i32 - 12;
                let phys_target_h = (target_h * scale) as i32;
                if pos.y + phys_target_h > max_phys_y {
                    let new_y = (max_phys_y - phys_target_h).max(m_pos.y + 12);
                    let _ = mini_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: pos.x,
                        y: new_y,
                    }));
                }
            }
        }

        let _ = mini_win.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: target_w,
            height: target_h,
        }));
    }
    Ok(())
}

/// Tauri Command: Play track at index in current queue from mini player
#[tauri::command]
pub fn play_queue_index(app: AppHandle, index: usize) {
    if let Some(main_win) = app.get_webview_window("main") {
        let script = format!(
            "if (typeof window.__bbplayer_play_index === 'function') {{ window.__bbplayer_play_index({}); }}",
            index
        );
        let _ = main_win.eval(&script);
    }
}

fn calculate_dir_size(path: &std::path::Path) -> u64 {
    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                size += calculate_dir_size(&p);
            } else if let Ok(meta) = entry.metadata() {
                size += meta.len();
            }
        }
    }
    size
}

/// Tauri Command: Get total cache size in bytes (EBWebView Cache + audio_cache)
#[tauri::command]
pub fn get_app_cache_size(app: AppHandle) -> Result<u64, String> {
    use tauri::Manager;
    let mut total_size: u64 = 0;

    // 1. EBWebView/Default/Cache & components
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let eb_cache = std::path::PathBuf::from(local_app_data)
            .join("com.biliplayer.desktop")
            .join("EBWebView")
            .join("Default")
            .join("Cache");
        if eb_cache.exists() {
            total_size += calculate_dir_size(&eb_cache);
        }
    }

    // 2. stream_proxy audio_cache
    if let Ok(cache_dir) = app.path().app_cache_dir() {
        let audio_cache = cache_dir.join("audio_cache");
        if audio_cache.exists() {
            total_size += calculate_dir_size(&audio_cache);
        }
    }

    Ok(total_size)
}

/// Tauri Command: Clear temporary caches (audio cache + EBWebView cache)
#[tauri::command]
pub fn clear_app_cache(app: AppHandle) -> Result<(), String> {
    use tauri::Manager;

    // 1. Clear stream_proxy audio_cache
    if let Ok(cache_dir) = app.path().app_cache_dir() {
        let audio_cache = cache_dir.join("audio_cache");
        if audio_cache.exists() {
            let _ = std::fs::remove_dir_all(&audio_cache);
            let _ = std::fs::create_dir_all(&audio_cache);
        }
    }

    // 2. Clear EBWebView Cache files (delete files inside EBWebView/Default/Cache)
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let base_dir = std::path::PathBuf::from(local_app_data);
        let eb_cache = base_dir
            .join("com.biliplayer.desktop")
            .join("EBWebView")
            .join("Default")
            .join("Cache");
        if eb_cache.exists() {
            if let Ok(entries) = std::fs::read_dir(&eb_cache) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        let _ = std::fs::remove_dir_all(&p);
                    } else {
                        let _ = std::fs::remove_file(&p);
                    }
                }
            }
        }

        // Also prune any leftover junk components
        let ebwebview = base_dir
            .join("com.biliplayer.desktop")
            .join("EBWebView");
        let junk_dirs = [
            "component_crx_cache",
            "WidevineCdm",
            "Subresource Filter",
            "Speech Recognition",
        ];
        for junk in junk_dirs {
            let p = ebwebview.join(junk);
            if p.exists() {
                let _ = std::fs::remove_dir_all(p);
            }
        }
    }

    Ok(())
}

