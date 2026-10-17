pub mod exporter;
pub mod http_client;
pub mod shortcuts;
pub mod stream_proxy;
pub mod window_ext;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_single_instance::init(|app, _args, _cwd| {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.unminimize();
                    let _ = win.show();
                    let _ = win.set_focus();
                }
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
            window_ext::append_debug_log,
            stream_proxy::get_stream_proxy_port,
            stream_proxy::get_cached_track_path,
            exporter::export_cached_track_to_m4a,
            exporter::pick_export_path,
            http_client::native_http_request,
            shortcuts::get_shortcuts,
            shortcuts::get_shortcut_statuses,
            shortcuts::update_shortcuts,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            eprintln!("[BBPlayer] setup closure invoked");
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

            // 3. Setup System Tray Menu with unified Dark Mode aesthetics
            let open_main = MenuItem::with_id(app, "open_main", "打开主界面", true, None::<&str>)?;
            let open_settings = MenuItem::with_id(app, "open_settings", "偏好设置...", true, None::<&str>)?;

            let sep1 = PredefinedMenuItem::separator(app)?;

            let play_pause = MenuItem::with_id(app, "play_pause", "播放 / 暂停 (Space)", true, None::<&str>)?;
            let prev_track = MenuItem::with_id(app, "prev_track", "上一首 (Ctrl+Left)", true, None::<&str>)?;
            let next_track = MenuItem::with_id(app, "next_track", "下一首 (Ctrl+Right)", true, None::<&str>)?;

            let sep2 = PredefinedMenuItem::separator(app)?;

            let toggle_lyrics = MenuItem::with_id(app, "toggle_lyrics", "显示/隐藏桌面歌词 (Ctrl+Alt+D)", true, None::<&str>)?;
            let toggle_lock = MenuItem::with_id(app, "toggle_lock", "锁定/解锁桌面歌词 (Ctrl+Alt+L)", true, None::<&str>)?;

            let sep3 = PredefinedMenuItem::separator(app)?;

            let quit_item = MenuItem::with_id(app, "quit", "退出 Bili Player", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &open_main,
                    &open_settings,
                    &sep1,
                    &play_pause,
                    &prev_track,
                    &next_track,
                    &sep2,
                    &toggle_lyrics,
                    &toggle_lock,
                    &sep3,
                    &quit_item,
                ],
            )?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .menu(&menu)
                    .icon(icon.clone())
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "open_main" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "open_settings" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                                let _ = win.emit("navigate-to-tab", "settings");
                            }
                        }
                        "play_pause" => {
                            let _ = app.emit("global-shortcut-event", "play_pause");
                        }
                        "prev_track" => {
                            let _ = app.emit("global-shortcut-event", "prev_track");
                        }
                        "next_track" => {
                            let _ = app.emit("global-shortcut-event", "next_track");
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
