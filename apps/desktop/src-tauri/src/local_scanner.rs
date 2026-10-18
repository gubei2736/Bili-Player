use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScannedAudioFile {
    pub path: String,
    pub filename: String,
    pub title: String,
    pub artist: String,
    pub size: u64,
    pub extension: String,
}

const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "m4a", "ogg", "aac", "wma"];

/// Tauri Command: 打开系统目录选择对话框，选择要扫描的本地音乐文件夹
#[tauri::command]
pub async fn pick_local_music_dir(default_dir: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("选择本地音乐扫描文件夹");
    if let Some(ref dir) = default_dir {
        dialog = dialog.set_directory(dir);
    }
    let folder = dialog.pick_folder().await;
    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

/// 递归扫描目录（限制最大递归深度为 6，防止无限循环或过深遍历）
fn scan_dir_recursive(dir: &Path, depth: usize, max_depth: usize, results: &mut Vec<ScannedAudioFile>) {
    if depth > max_depth {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_dir_recursive(&path, depth + 1, max_depth, results);
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                let lower_ext = ext.to_ascii_lowercase();
                if SUPPORTED_EXTENSIONS.contains(&lower_ext.as_str()) {
                    let filename = path.file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();
                    let file_stem = path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();

                    // 智能解析文件名："歌手 - 歌名" 或 "歌名"
                    let (artist, title) = if file_stem.contains(" - ") {
                        let parts: Vec<&str> = file_stem.splitn(2, " - ").collect();
                        (parts[0].trim().to_string(), parts[1].trim().to_string())
                    } else if file_stem.contains(" — ") {
                        let parts: Vec<&str> = file_stem.splitn(2, " — ").collect();
                        (parts[0].trim().to_string(), parts[1].trim().to_string())
                    } else if file_stem.contains('_') && !file_stem.starts_with('_') {
                        let parts: Vec<&str> = file_stem.splitn(2, '_').collect();
                        if parts[0].len() <= 20 && parts[1].len() > 0 {
                            (parts[0].trim().to_string(), parts[1].trim().to_string())
                        } else {
                            ("本地音乐".to_string(), file_stem.clone())
                        }
                    } else {
                        ("本地音乐".to_string(), file_stem.clone())
                    };

                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                    results.push(ScannedAudioFile {
                        path: path.to_string_lossy().to_string(),
                        filename,
                        title: if title.is_empty() { file_stem } else { title },
                        artist: if artist.is_empty() { "本地歌手".to_string() } else { artist },
                        size,
                        extension: lower_ext,
                    });
                }
            }
        }
    }
}

/// Tauri Command: 扫描指定目录下的音频文件
#[tauri::command]
pub async fn scan_local_music_dir(dir_path: String) -> Result<Vec<ScannedAudioFile>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.exists() {
        return Err("指定的目录不存在".to_string());
    }
    if !path.is_dir() {
        return Err("指定的路径不是文件夹目录".to_string());
    }

    let mut results = Vec::new();
    scan_dir_recursive(&path, 0, 6, &mut results);

    // 按照歌曲标题自然排序
    results.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));

    Ok(results)
}
