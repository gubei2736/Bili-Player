pub mod exporter;
pub mod http_client;
pub mod shortcuts;
pub mod stream_proxy;
pub mod window_ext;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    shortcuts::handle_shortcut_event(app, shortcut, event.state());
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            window_ext::exit_app,
            window_ext::set_ignore_cursor_events,
            window_ext::toggle_lyrics_window,
            window_ext::toggle_lyrics_lock,
            window_ext::append_debug_log,
            stream_proxy::get_stream_proxy_port,
            stream_proxy::get_cached_track_path,
            exporter::export_cached_track_to_m4a,
            http_client::native_http_request,
            shortcuts::get_shortcuts,
            shortcuts::get_shortcut_statuses,
            shortcuts::update_shortcuts,
        ])
        .setup(|app| {
            eprintln!("[BBPlayer] setup closure invoked");
            // 1. Apply native window effects to main window & handle close requests
            if let Some(main_win) = app.get_webview_window("main") {
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
                eprintln!("[BBPlayer] WARNING: main window NOT found in app.get_webview_window(\"main\")!");
            }

            // 2. Register default global shortcuts
            let default_shortcuts = shortcuts::get_default_shortcuts();
            shortcuts::register_all_shortcuts(app.handle(), &default_shortcuts);

            // 3. Setup System Tray Menu
            let toggle_main = MenuItem::with_id(app, "toggle_main", "显示/隐藏主窗口", true, None::<&str>)?;
            let toggle_lyrics = MenuItem::with_id(app, "toggle_lyrics", "显示/隐藏桌面歌词", true, None::<&str>)?;
            let toggle_lock = MenuItem::with_id(app, "toggle_lock", "锁定/解锁桌面歌词 (Ctrl+Alt+L)", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出 Bili Player", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_main, &toggle_lyrics, &toggle_lock, &quit_item])?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .menu(&menu)
                    .icon(icon.clone())
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "toggle_main" => {
                            if let Some(win) = app.get_webview_window("main") {
                                if let Ok(visible) = win.is_visible() {
                                    if visible {
                                        let _ = win.hide();
                                    } else {
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                }
                            }
                        }
                        "toggle_lyrics" => {
                            let _ = window_ext::toggle_lyrics_window(app.clone());
                        }
                        "toggle_lock" => {
                            let _ = window_ext::toggle_lyrics_lock(app.clone());
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
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
