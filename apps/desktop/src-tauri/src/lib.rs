pub mod stream_proxy;
pub mod window_ext;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            window_ext::set_ignore_cursor_events,
            window_ext::toggle_lyrics_window,
            stream_proxy::get_stream_proxy_port,
            stream_proxy::get_cached_track_path,
        ])
        .setup(|app| {
            // 1. Apply native window effects to main window
            if let Some(main_win) = app.get_webview_window("main") {
                window_ext::setup_window_effects(&main_win);
            }

            // 2. Start local stream proxy on loopback
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let cache_dir = app_handle
                    .path()
                    .app_cache_dir()
                    .unwrap_or_else(|_| std::env::temp_dir());
                let _ = std::fs::create_dir_all(&cache_dir);
                if let Ok(port) = stream_proxy::start_proxy_server(cache_dir).await {
                    log::info!("Local streaming proxy running on http://127.0.0.1:{}", port);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
