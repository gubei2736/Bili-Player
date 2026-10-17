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

    /// Completely remove Windows 11 DWM 1px white border and rectangular frame on transparent windows
    pub fn remove_dwm_border(hwnd_isize: isize) {
        unsafe {
            let dwmapi = LoadLibraryA(b"dwmapi.dll\0".as_ptr());
            if !dwmapi.is_null() {
                let set_attr_ptr = GetProcAddress(dwmapi, b"DwmSetWindowAttribute\0".as_ptr());
                if !set_attr_ptr.is_null() {
                    let set_attr: unsafe extern "system" fn(
                        isize,
                        u32,
                        *const std::ffi::c_void,
                        u32,
                    ) -> i32 = std::mem::transmute(set_attr_ptr);

                    // 1. DWMWA_BORDER_COLOR = 34, DWMWA_COLOR_NONE = 0xFFFFFFFE (Disables the 1px white border on Win11)
                    let color: u32 = 0xFFFFFFFE;
                    let _ = set_attr(
                        hwnd_isize,
                        34,
                        &color as *const _ as *const std::ffi::c_void,
                        std::mem::size_of::<u32>() as u32,
                    );

                    // 2. DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWCP_DONOTROUND = 1
                    let corner: u32 = 1;
                    let _ = set_attr(
                        hwnd_isize,
                        33,
                        &corner as *const _ as *const std::ffi::c_void,
                        std::mem::size_of::<u32>() as u32,
                    );

                    // 3. DWMWA_NCRENDERING_POLICY = 2, DWMNCRP_DISABLED = 1
                    let nc_policy: u32 = 1;
                    let _ = set_attr(
                        hwnd_isize,
                        2,
                        &nc_policy as *const _ as *const std::ffi::c_void,
                        std::mem::size_of::<u32>() as u32,
                    );
                }
                FreeLibrary(dwmapi);
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn enable_windows_dark_mode() {
    win32_theme::enable_windows_dark_mode();
}

/// Configure lyrics window to be completely borderless with no DWM shadow or border
pub fn setup_lyrics_window(window: &WebviewWindow) {
    let _ = window.set_shadow(false);
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            win32_theme::remove_dwm_border(hwnd.0 as isize);
        }
    }
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
