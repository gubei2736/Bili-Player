use tauri::{AppHandle, Manager, WebviewWindow};

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
        if window_vibrancy::apply_mica(window, Some(true)).is_err() {
            // Fallback to Acrylic if Mica is unsupported (Win10)
            let _ = window_vibrancy::apply_acrylic(window, Some((20, 20, 25, 180)));
        }
    }

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
pub fn set_ignore_cursor_events(window: WebviewWindow, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

/// Tauri Command: Show or hide lyrics window
#[tauri::command]
pub fn toggle_lyrics_window(app: AppHandle) -> Result<bool, String> {
    if let Some(lyrics_win) = app.get_webview_window("lyrics") {
        let is_visible = lyrics_win.is_visible().map_err(|e| e.to_string())?;
        if is_visible {
            lyrics_win.hide().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            lyrics_win.show().map_err(|e| e.to_string())?;
            lyrics_win.set_focus().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else {
        Err("Lyrics window not found".to_string())
    }
}
