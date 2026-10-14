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
            key: "Ctrl+Alt+Space".into(),
            description: "全局：播放 / 暂停".into(),
        },
        ShortcutConfig {
            id: "prev_track".into(),
            key: "Ctrl+Alt+ArrowLeft".into(),
            description: "全局：上一首".into(),
        },
        ShortcutConfig {
            id: "next_track".into(),
            key: "Ctrl+Alt+ArrowRight".into(),
            description: "全局：下一首".into(),
        },
        ShortcutConfig {
            id: "toggle_lyrics".into(),
            key: "Ctrl+Alt+D".into(),
            description: "全局：显示/隐藏桌面歌词".into(),
        },
        ShortcutConfig {
            id: "toggle_penetration".into(),
            key: "Ctrl+Alt+L".into(),
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

    let mut matched_id = None;
    for item in &active_configs {
        let normalized = normalize_shortcut_key(&item.key);
        if let Ok(s) = normalized.parse::<Shortcut>() {
            if shortcut == &s {
                matched_id = Some(item.id.clone());
                break;
            }
        }
    }

    let action_id = match matched_id {
        Some(ref id) => id.clone(),
        None => current_str,
    };

    match action_id.as_str() {
        "toggle_penetration" => {
            let new_state = !LYRICS_IGNORE_CURSOR.load(Ordering::SeqCst);
            LYRICS_IGNORE_CURSOR.store(new_state, Ordering::SeqCst);
            if let Some(lyrics_win) = app.get_webview_window("lyrics") {
                let _ = lyrics_win.set_ignore_cursor_events(new_state);
            }
            let _ = app.emit("lyrics-lock-change", new_state);
        }
        "toggle_lyrics" => {
            let _ = crate::window_ext::toggle_lyrics_window(app.clone());
        }
        _ => {}
    }

    // 1. 标准 Tauri IPC 事件派发
    let _ = app.emit("global-shortcut-event", &action_id);

    // 2. 双保险：直接在主窗口执行 window.__triggerGlobalShortcut，防止失焦时 Webview 事件被系统队列节流延迟
    if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(json_id) = serde_json::to_string(&action_id) {
            let script = format!(
                "if (window.__triggerGlobalShortcut) {{ window.__triggerGlobalShortcut({}); }}",
                json_id
            );
            let _ = main_win.eval(&script);
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_shortcuts() {
        let list = vec![
            "Alt+Shift+Space",
            "Alt+Shift+ArrowLeft",
            "Alt+Shift+ArrowRight",
            "Alt+Shift+D",
            "Alt+Shift+L",
            "Alt+Shift+Left",
            "Alt+Shift+Right",
            "Ctrl+Alt+Space",
            "Ctrl+Alt+ArrowLeft",
            "Ctrl+Alt+ArrowRight",
            "Ctrl+Alt+D",
            "Ctrl+Alt+L",
            "Control+Alt+Space",
        ];
        for s in list {
            let normalized = normalize_shortcut_key(s);
            let parsed = normalized.parse::<Shortcut>();
            println!("original: {}, normalized: {}, parsed: {:?}", s, normalized, parsed);
            assert!(parsed.is_ok(), "Failed to parse: {} (normalized: {})", s, normalized);
        }
    }
}

