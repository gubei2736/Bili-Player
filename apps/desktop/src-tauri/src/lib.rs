pub mod exporter;
pub mod http_client;
pub mod local_scanner;
pub mod shortcuts;
pub mod stream_proxy;
pub mod window_ext;

use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_single_instance::init(|app, _args, _cwd| {
                let _ = window_ext::restore_main_from_mini(app.clone());
            }),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    shortcuts::handle_shortcut_event(app, shortcut, event.state());
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            window_ext::is_debug_mode,
            window_ext::exit_app,
            window_ext::set_ignore_cursor_events,
            window_ext::toggle_lyrics_window,
            window_ext::toggle_lyrics_lock,
            window_ext::is_lyrics_locked,
            window_ext::toggle_mini_player,
            window_ext::restore_main_from_mini,
            window_ext::show_tray_menu,
            window_ext::append_debug_log,
            window_ext::get_debug_log_path,
            window_ext::open_debug_log_file,
            window_ext::open_external_url,
            window_ext::toggle_devtools,
            window_ext::trigger_player_action,
            window_ext::player_seek,
            window_ext::player_toggle_mute,
            window_ext::player_toggle_mode,
            window_ext::player_request_sync,
            window_ext::set_mini_player_expanded,
            window_ext::play_queue_index,
            stream_proxy::get_stream_proxy_port,
            stream_proxy::get_cached_track_path,
            exporter::export_cached_track_to_m4a,
            exporter::pick_export_path,
            exporter::pick_export_dir,
            local_scanner::pick_local_music_dir,
            local_scanner::scan_local_music_dir,
            http_client::native_http_request,
            shortcuts::get_shortcuts,
            shortcuts::get_shortcut_statuses,
            shortcuts::update_shortcuts,
            window_ext::get_app_cache_size,
            window_ext::clear_app_cache,
            window_ext::toggle_main_window_fullscreen,
            window_ext::is_main_window_fullscreen,
            window_ext::set_main_window_fullscreen,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let log_path = window_ext::get_log_file_path();
                window_ext::write_log_line(&format!("======================================================"));
                window_ext::write_log_line(&format!("[Bili Player] Debug mode active! Process ID: {}", std::process::id()));
                window_ext::write_log_line(&format!("[Bili Player] Debug log file located at: {:?}", log_path));
                window_ext::write_log_line(&format!("======================================================"));
            }
            // 1. Apply native window effects to main window & handle close requests
            if let Some(main_win) = app.get_webview_window("main") {
                #[cfg(debug_assertions)]
                eprintln!("[BBPlayer] main window found, setting up window effects");
                window_ext::setup_window_effects(&main_win);

                let app_handle_for_close = app.handle().clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = app_handle_for_close.emit("request-window-close", ());
                    }
                });
            } else {
                #[cfg(debug_assertions)]
                eprintln!("[BBPlayer] WARNING: main window NOT found in app.get_webview_window(\"main\")!");
            }

            // 2. Register default global shortcuts
            let default_shortcuts = shortcuts::get_default_shortcuts();
            shortcuts::register_all_shortcuts(app.handle(), &default_shortcuts);

            // Enable dark mode for all Win32 menus and system controls
            #[cfg(target_os = "windows")]
            window_ext::enable_windows_dark_mode();

            // Setup desktop lyrics window effects and remove borders
            if let Some(lyrics_win) = app.get_webview_window("lyrics") {
                window_ext::setup_lyrics_window(&lyrics_win);
            }

            // Setup mini player window effects and remove borders/shadow
            if let Some(mini_win) = app.get_webview_window("mini") {
                window_ext::setup_mini_window(&mini_win);
            }

            // 3. Setup focus loss handler for tray_menu window
            if let Some(tray_win) = app.get_webview_window("tray_menu") {
                let tray_win_clone = tray_win.clone();
                tray_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = tray_win_clone.hide();
                    }
                });
            }

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if button == tauri::tray::MouseButton::Left {
                                let _ = window_ext::restore_main_from_mini(app.clone());
                            } else if button == tauri::tray::MouseButton::Right {
                                let _ = window_ext::show_tray_menu(app.clone());
                            }
                        }
                    })
                    .build(app)?;
            }

            // 4. Start local stream proxy on loopback
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
