use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub id: String,          // e.g. "play_pause", "prev_track", "next_track", "toggle_lyrics", "toggle_penetration"
    pub key: String,         // e.g. "Ctrl+Alt+Space"
    pub description: String, // e.g. "播放 / 暂停"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutStatus {
    pub id: String,
    pub key: String,
    pub registered: bool,
    pub error: Option<String>,
}

pub static LYRICS_IGNORE_CURSOR: AtomicBool = AtomicBool::new(false);

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

static CURRENT_SHORTCUTS: Mutex<Option<Vec<ShortcutConfig>>> = Mutex::new(None);
static SHORTCUT_ID_MAP: Mutex<Option<HashMap<u32, String>>> = Mutex::new(None);
static LAST_REGISTRATION_STATUS: Mutex<Vec<ShortcutStatus>> = Mutex::new(Vec::new());

/// 将前端录制的键名标准化为 Tauri keyboard-types 规范格式
pub fn normalize_shortcut_key(raw: &str) -> String {
    raw.split('+')
        .map(|part| {
            let trimmed = part.trim();
            match trimmed.to_lowercase().as_str() {
                "ctrl" | "control" => "Control".to_string(),
                "alt" | "option" => "Alt".to_string(),
                "shift" => "Shift".to_string(),
                "super" | "meta" | "win" | "cmd" | "command" => "Super".to_string(),
                "left" | "arrowleft" => "ArrowLeft".to_string(),
                "right" | "arrowright" => "ArrowRight".to_string(),
                "up" | "arrowup" => "ArrowUp".to_string(),
                "down" | "arrowdown" => "ArrowDown".to_string(),
                "space" | "spacebar" | "" => "Space".to_string(),
                other => {
                    if other.len() == 1 {
                        other.to_uppercase()
                    } else {
                        trimmed.to_string()
                    }
                }
            }
        })
        .collect::<Vec<_>>()
        .join("+")
}

/// 检查热键是否带有操作系统级全局热键必需的修饰键
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

pub fn register_all_shortcuts(app: &AppHandle, configs: &[ShortcutConfig]) -> Vec<ShortcutStatus> {
    {
        let mut lock = CURRENT_SHORTCUTS.lock().unwrap();
        *lock = Some(configs.to_vec());
    }

    let global_shortcut = app.global_shortcut();
    if let Err(e) = global_shortcut.unregister_all() {
        eprintln!("[BBPlayer Shortcuts] unregister_all note: {:?}", e);
    }

    let mut id_map = HashMap::new();
    let mut statuses = Vec::new();

    for cfg in configs {
        let key_str = cfg.key.trim();
        if key_str.is_empty() {
            statuses.push(ShortcutStatus {
                id: cfg.id.clone(),
                key: String::new(),
                registered: false,
                error: Some("未设置快捷键".into()),
            });
            continue;
        }

        // 不含修饰键的单键（如 Space）仅限窗口内响应，不能注册为 OS 全局热键
        if !has_modifier(key_str) {
            statuses.push(ShortcutStatus {
                id: cfg.id.clone(),
                key: key_str.to_string(),
                registered: false,
                error: Some("单键仅在窗口内生效，后台全局控制需包含 Ctrl/Alt/Shift 组合".into()),
            });
            continue;
        }

        let normalized = normalize_shortcut_key(key_str);
        match normalized.parse::<Shortcut>() {
            Ok(shortcut) => {
                let sc_id = shortcut.id();
                match global_shortcut.register(shortcut) {
                    Ok(_) => {
                        eprintln!(
                            "[BBPlayer Shortcuts] Successfully registered global hotkey: {} -> {} (id={})",
                            normalized, cfg.id, sc_id
                        );
                        id_map.insert(sc_id, cfg.id.clone());
                        statuses.push(ShortcutStatus {
                            id: cfg.id.clone(),
                            key: key_str.to_string(),
                            registered: true,
                            error: None,
                        });
                    }
                    Err(err) => {
                        let err_msg = format!("热键被其他软件占用或系统拒绝: {}", err);
                        eprintln!(
                            "[BBPlayer Shortcuts] FAILED to register {} ({}): {}",
                            normalized, cfg.id, err
                        );
                        statuses.push(ShortcutStatus {
                            id: cfg.id.clone(),
                            key: key_str.to_string(),
                            registered: false,
                            error: Some(err_msg),
                        });
                    }
                }
            }
            Err(err) => {
                let err_msg = format!("无法解析键位格式 ({}): {:?}", normalized, err);
                eprintln!("[BBPlayer Shortcuts] {}", err_msg);
                statuses.push(ShortcutStatus {
                    id: cfg.id.clone(),
                    key: key_str.to_string(),
                    registered: false,
                    error: Some(err_msg),
                });
            }
        }
    }

    {
        let mut map_lock = SHORTCUT_ID_MAP.lock().unwrap();
        *map_lock = Some(id_map);
    }
    {
        let mut status_lock = LAST_REGISTRATION_STATUS.lock().unwrap();
        *status_lock = statuses.clone();
    }

    statuses
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }

    let incoming_id = shortcut.id();
    eprintln!(
        "[BBPlayer Shortcuts] OS Hotkey Pressed: {:?} (id={})",
        shortcut, incoming_id
    );

    // 1. 优先通过底层 u32 Shortcut ID 精确匹配动作 ID
    let mut matched_id: Option<String> = {
        let map_lock = SHORTCUT_ID_MAP.lock().unwrap();
        map_lock
            .as_ref()
            .and_then(|map| map.get(&incoming_id).cloned())
    };

    // 2. 兜底：如果 ID 表未命中，遍历配置比对 Shortcut 实例与 id()
    if matched_id.is_none() {
        let active_configs = {
            let lock = CURRENT_SHORTCUTS.lock().unwrap();
            lock.clone().unwrap_or_else(get_default_shortcuts)
        };

        for item in &active_configs {
            let normalized = normalize_shortcut_key(&item.key);
            if let Ok(s) = normalized.parse::<Shortcut>() {
                if s.id() == incoming_id || &s == shortcut {
                    matched_id = Some(item.id.clone());
                    break;
                }
            }
        }
    }

    let action_id = match matched_id {
        Some(id) => id,
        None => {
            eprintln!(
                "[BBPlayer Shortcuts] Unmatched shortcut pressed: {:?}",
                shortcut
            );
            return;
        }
    };

    eprintln!("[BBPlayer Shortcuts] Dispatching action: {}", action_id);

    // 3. 原生窗口层动作直接由 Rust 执行，零延迟且不受 WebView 休眠影响
    match action_id.as_str() {
        "toggle_penetration" => {
            let new_state = !LYRICS_IGNORE_CURSOR.load(Ordering::SeqCst);
            LYRICS_IGNORE_CURSOR.store(new_state, Ordering::SeqCst);
            if let Some(lyrics_win) = app.get_webview_window("lyrics") {
                let _ = lyrics_win.set_ignore_cursor_events(new_state);
            }
            let _ = app.emit("lyrics-lock-change", new_state);
            return;
        }
        "toggle_lyrics" => {
            let _ = crate::window_ext::toggle_lyrics_window(app.clone());
            return;
        }
        _ => {}
    }

    // 4. 音频控制动作（play_pause / prev_track / next_track）三路并发唤醒主窗口执行：
    // 路径 A: 全局广播
    let _ = app.emit("global-shortcut-event", &action_id);

    if let Some(main_win) = app.get_webview_window("main") {
        // 路径 B: 定向发送给 main 窗口
        let _ = main_win.emit("global-shortcut-event", &action_id);

        // 路径 C: 直接通过 WebView2 底层 eval 注入调用，无视后台 IPC 队列节流
        if let Ok(json_id) = serde_json::to_string(&action_id) {
            let script = format!(
                "if (typeof window.__triggerGlobalShortcut === 'function') {{ window.__triggerGlobalShortcut({}); }}",
                json_id
            );
            if let Err(e) = main_win.eval(&script) {
                eprintln!("[BBPlayer Shortcuts] main_win.eval error: {:?}", e);
            }
        }
    }
}

#[tauri::command]
pub fn get_shortcuts() -> Vec<ShortcutConfig> {
    let lock = CURRENT_SHORTCUTS.lock().unwrap();
    lock.clone().unwrap_or_else(get_default_shortcuts)
}

#[tauri::command]
pub fn get_shortcut_statuses() -> Vec<ShortcutStatus> {
    let lock = LAST_REGISTRATION_STATUS.lock().unwrap();
    lock.clone()
}

#[tauri::command]
pub fn update_shortcuts(
    app: AppHandle,
    configs: Vec<ShortcutConfig>,
) -> Result<Vec<ShortcutStatus>, String> {
    let statuses = register_all_shortcuts(&app, &configs);
    Ok(statuses)
}
