use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

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

/// Tauri Command: Set ignore cursor events (mouse penetration) for lyrics window
#[tauri::command]
pub fn set_ignore_cursor_events(
    app: AppHandle,
    window: WebviewWindow,
    ignore: bool,
) -> Result<(), String> {
    crate::shortcuts::LYRICS_IGNORE_CURSOR.store(ignore, Ordering::SeqCst);
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

/// Tauri Command: Append debug log message directly to disk
#[tauri::command]
pub fn append_debug_log(message: String) {
    use std::fs::OpenOptions;
    use std::io::Write;
    if let Ok(mut path) = std::env::temp_dir().into_os_string().into_string() {
        path.push_str("\\bbplayer_debug.log");
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(file, "{}", message);
        }
    }
}
