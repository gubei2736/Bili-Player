pub mod exporter;
pub mod stream_proxy;
pub mod window_ext;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Ok(target) = "Alt+Shift+L".parse::<Shortcut>() {
                            if shortcut == &target {
                                if let Some(lyrics_win) = app.get_webview_window("lyrics") {
                                    // Unlock mouse penetration when pressing shortcut
                                    let _ = lyrics_win.set_ignore_cursor_events(false);
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            window_ext::set_ignore_cursor_events,
            window_ext::toggle_lyrics_window,
            stream_proxy::get_stream_proxy_port,
            stream_proxy::get_cached_track_path,
            exporter::export_cached_track_to_m4a,
        ])
        .setup(|app| {
            eprintln!("[BBPlayer] setup closure invoked");
            // 1. Apply native window effects to main window
            if let Some(main_win) = app.get_webview_window("main") {
                eprintln!("[BBPlayer] main window found, setting up window effects");
                window_ext::setup_window_effects(&main_win);
            } else {
                eprintln!("[BBPlayer] WARNING: main window NOT found in app.get_webview_window(\"main\")!");
            }

            // 2. Register global shortcut (Alt+Shift+L)
            if let Ok(shortcut) = "Alt+Shift+L".parse::<Shortcut>() {
                let reg_res = app.global_shortcut().register(shortcut);
                eprintln!("[BBPlayer] global shortcut register result: {:?}", reg_res);
            }

            // 3. Setup System Tray Menu
            let toggle_main = MenuItem::with_id(app, "toggle_main", "显示/隐藏主窗口", true, None::<&str>)?;
            let toggle_lyrics = MenuItem::with_id(app, "toggle_lyrics", "显示/隐藏桌面歌词", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出 BBPlayer", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_main, &toggle_lyrics, &quit_item])?;

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
                        _ => {}
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
