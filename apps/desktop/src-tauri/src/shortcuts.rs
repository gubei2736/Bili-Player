use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub id: String,          // e.g. "play_pause", "prev_track", "next_track", "toggle_lyrics", "toggle_penetration"
    pub key: String,         // e.g. "Alt+Shift+Space"
    pub description: String, // e.g. "播放 / 暂停"
}

pub fn get_default_shortcuts() -> Vec<ShortcutConfig> {
    vec![
        ShortcutConfig {
            id: "play_pause".into(),
            key: "Alt+Shift+Space".into(),
            description: "全局：播放 / 暂停".into(),
        },
        ShortcutConfig {
            id: "prev_track".into(),
            key: "Alt+Shift+Left".into(),
            description: "全局：上一首".into(),
        },
        ShortcutConfig {
            id: "next_track".into(),
            key: "Alt+Shift+Right".into(),
            description: "全局：下一首".into(),
        },
        ShortcutConfig {
            id: "toggle_lyrics".into(),
            key: "Alt+Shift+D".into(),
            description: "全局：显示/隐藏桌面歌词".into(),
        },
        ShortcutConfig {
            id: "toggle_penetration".into(),
            key: "Alt+Shift+L".into(),
            description: "全局：切换歌词鼠标穿透".into(),
        },
    ]
}

static CURRENT_SHORTCUTS: std::sync::Mutex<Option<Vec<ShortcutConfig>>> =
    std::sync::Mutex::new(None);

pub fn register_all_shortcuts(app: &AppHandle, configs: &[ShortcutConfig]) {
    let global_shortcut = app.global_shortcut();
    let _ = global_shortcut.unregister_all();

    for cfg in configs {
        if cfg.key.trim().is_empty() {
            continue;
        }
        if let Ok(shortcut) = cfg.key.parse::<Shortcut>() {
            let _ = global_shortcut.register(shortcut);
        }
    }
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }

    let current_str = shortcut.to_string();

    // Look for matching action in current active shortcuts or defaults
    let active_configs = {
        let lock = CURRENT_SHORTCUTS.lock().unwrap();
        lock.clone().unwrap_or_else(get_default_shortcuts)
    };

    for item in active_configs {
        if let Ok(s) = item.key.parse::<Shortcut>() {
            if shortcut == &s {
                match item.id.as_str() {
                    "toggle_penetration" => {
                        if let Some(lyrics_win) = app.get_webview_window("lyrics") {
                            let _ = lyrics_win.set_ignore_cursor_events(false);
                        }
                    }
                    "toggle_lyrics" => {
                        let _ = crate::window_ext::toggle_lyrics_window(app.clone());
                    }
                    _ => {}
                }
                let _ = app.emit("global-shortcut-event", item.id);
                return;
            }
        }
    }

    let _ = app.emit("global-shortcut-event", current_str);
}

#[tauri::command]
pub fn get_shortcuts() -> Vec<ShortcutConfig> {
    let lock = CURRENT_SHORTCUTS.lock().unwrap();
    lock.clone().unwrap_or_else(get_default_shortcuts)
}

#[tauri::command]
pub fn update_shortcuts(app: AppHandle, configs: Vec<ShortcutConfig>) -> Result<(), String> {
    {
        let mut lock = CURRENT_SHORTCUTS.lock().unwrap();
        *lock = Some(configs.clone());
    }
    register_all_shortcuts(&app, &configs);
    Ok(())
}
