use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub id: String,          // e.g. "play_pause", "prev_track", "next_track", "toggle_lyrics", "toggle_penetration"
    pub key: String,         // e.g. "Alt+Shift+Space"
    pub description: String, // e.g. "播放 / 暂停"
}

static LYRICS_IGNORE_CURSOR: AtomicBool = AtomicBool::new(false);

pub fn get_default_shortcuts() -> Vec<ShortcutConfig> {
    vec![
        ShortcutConfig {
            id: "play_pause".into(),
            key: "Alt+Shift+Space".into(),
            description: "全局：播放 / 暂停".into(),
        },
        ShortcutConfig {
            id: "prev_track".into(),
            key: "Alt+Shift+ArrowLeft".into(),
            description: "全局：上一首".into(),
        },
        ShortcutConfig {
            id: "next_track".into(),
            key: "Alt+Shift+ArrowRight".into(),
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

/// 将前端键名标准化为 Tauri keyboard-types 规范格式
fn normalize_shortcut_key(raw: &str) -> String {
    raw.split('+')
        .map(|part| match part.trim() {
            "Left" | "left" => "ArrowLeft",
            "Right" | "right" => "ArrowRight",
            "Up" | "up" => "ArrowUp",
            "Down" | "down" => "ArrowDown",
            "Ctrl" | "ctrl" => "Control",
            other => other,
        })
        .collect::<Vec<_>>()
        .join("+")
}

/// 检查热键是否带有 Windows 系统级热键必需的修饰键
fn has_modifier(raw: &str) -> bool {
    let lower = raw.to_lowercase();
    lower.contains("alt+")
        || lower.contains("ctrl+")
        || lower.contains("control+")
        || lower.contains("shift+")
        || lower.contains("super+")
        || lower.contains("meta+")
        || lower.contains("commandorcontrol+")
}

pub fn register_all_shortcuts(app: &AppHandle, configs: &[ShortcutConfig]) {
    {
        let mut lock = CURRENT_SHORTCUTS.lock().unwrap();
        *lock = Some(configs.to_vec());
    }

    let global_shortcut = app.global_shortcut();
    let _ = global_shortcut.unregister_all();

    for cfg in configs {
        let key_str = cfg.key.trim();
        if key_str.is_empty() {
            continue;
        }

        // 不含修饰键的单键（如 Space）由前端窗口内 keydown 处理，不向 OS 注册全局热键避免 Windows RegisterHotKey 报错
        if !has_modifier(key_str) {
            continue;
        }

        let normalized = normalize_shortcut_key(key_str);
        if let Ok(shortcut) = normalized.parse::<Shortcut>() {
            let _ = global_shortcut.register(shortcut);
        }
    }
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }

    let current_str = shortcut.to_string();

    // 在当前活跃配置或默认配置中匹配动作 ID
    let active_configs = {
        let lock = CURRENT_SHORTCUTS.lock().unwrap();
        lock.clone().unwrap_or_else(get_default_shortcuts)
    };

    for item in active_configs {
        let normalized = normalize_shortcut_key(&item.key);
        if let Ok(s) = normalized.parse::<Shortcut>() {
            if shortcut == &s {
                match item.id.as_str() {
                    "toggle_penetration" => {
                        let new_state = !LYRICS_IGNORE_CURSOR.load(Ordering::SeqCst);
                        LYRICS_IGNORE_CURSOR.store(new_state, Ordering::SeqCst);
                        if let Some(lyrics_win) = app.get_webview_window("lyrics") {
                            let _ = lyrics_win.set_ignore_cursor_events(new_state);
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
    register_all_shortcuts(&app, &configs);
    Ok(())
}
