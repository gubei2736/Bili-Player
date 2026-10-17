use mp4ameta::{Data, Fourcc, Tag};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct ExportTrackParams {
    #[serde(default)]
    pub cached_file_path: Option<String>,
    #[serde(default)]
    pub stream_url: Option<String>,
    #[serde(default)]
    pub cache_save_path: Option<String>,
    pub output_path: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub cover_url: Option<String>,
    pub lyrics: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub success: bool,
    pub file_path: String,
    pub file_size: u64,
}

#[tauri::command]
pub async fn export_cached_track_to_m4a(
    params: ExportTrackParams,
) -> Result<ExportResult, String> {
    let out_path = PathBuf::from(&params.output_path);
    if let Some(parent) = out_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // 1. Obtain audio data either from existing local cache or by downloading the stream
    let has_cached = match &params.cached_file_path {
        Some(p) if !p.trim().is_empty() => {
            let path = PathBuf::from(p);
            path.exists() && fs::metadata(&path).map(|m| m.len() > 0).unwrap_or(false)
        }
        _ => false,
    };

    if has_cached {
        let cached_path = PathBuf::from(params.cached_file_path.as_ref().unwrap());
        fs::copy(&cached_path, &out_path)
            .map_err(|e| format!("复制本地缓存音频文件失败: {}", e))?;
    } else if let Some(ref stream_url) = params.stream_url {
        if stream_url.trim().is_empty() {
            return Err("未找到本地缓存且音频流地址为空".to_string());
        }

        let client = reqwest::Client::builder()
            .user_agent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            .build()
            .map_err(|e| format!("初始化网络请求客户端失败: {}", e))?;

        let resp = client
            .get(stream_url)
            .header(reqwest::header::REFERER, "https://www.bilibili.com/")
            .send()
            .await
            .map_err(|e| format!("请求远程音频流失败: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("下载音频流服务器返回错误状态码: {}", resp.status()));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("读取音频流数据失败: {}", e))?;

        tokio::fs::write(&out_path, &bytes)
            .await
            .map_err(|e| format!("保存音频文件失败: {}", e))?;

        // If cache_save_path is provided, write a copy so that the player can reuse it
        if let Some(ref cache_save_path) = params.cache_save_path {
            let cache_p = PathBuf::from(cache_save_path);
            if let Some(parent) = cache_p.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = tokio::fs::write(&cache_p, &bytes).await;
        }
    } else {
        return Err("音频尚未在本地缓存，且未提供下载流地址".to_string());
    }

    // 2. Fetch cover image binary if provided
    let cover_data: Option<Vec<u8>> = if let Some(ref url) = params.cover_url {
        if let Ok(res) = reqwest::get(url).await {
            if let Ok(b) = res.bytes().await {
                Some(b.to_vec())
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    // 3. Tag metadata with mp4ameta
    match Tag::read_from_path(&out_path) {
        Ok(mut tag) => {
            tag.set_title(&params.title);
            tag.set_artist(&params.artist);
            if let Some(ref album) = params.album {
                tag.set_album(album);
            }
            if let Some(ref lyr) = params.lyrics {
                tag.set_lyrics(lyr);
            }
            if let Some(bytes) = cover_data {
                tag.set_data(Fourcc(*b"covr"), Data::Jpeg(bytes));
            }
            let _ = tag.write_to_path(&out_path);
        }
        Err(err) => {
            log::warn!("Could not parse mp4 atoms for tagging: {}", err);
        }
    }

    let meta = fs::metadata(&out_path).map_err(|e| e.to_string())?;

    Ok(ExportResult {
        success: true,
        file_path: out_path.to_string_lossy().to_string(),
        file_size: meta.len(),
    })
}

#[tauri::command]
pub async fn pick_export_path(
    default_filename: String,
    default_dir: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new()
        .set_file_name(&default_filename)
        .add_filter("MPEG-4 音频 (*.m4a)", &["m4a"]);

    if let Some(ref dir) = default_dir {
        dialog = dialog.set_directory(dir);
    }

    let file = dialog.save_file().await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

/// Tauri Command: Pick an export folder directory
#[tauri::command]
pub async fn pick_export_dir(default_dir: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("选择默认音频导出目录");
    if let Some(ref dir) = default_dir {
        dialog = dialog.set_directory(dir);
    }
    let folder = dialog.pick_folder().await;
    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

