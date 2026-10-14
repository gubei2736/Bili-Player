use mp4ameta::{Data, Fourcc, Tag};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct ExportTrackParams {
    pub cached_file_path: String,
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
    let cached_path = PathBuf::from(&params.cached_file_path);
    if !cached_path.exists() {
        return Err(format!("缓存音频文件不存在: {}", params.cached_file_path));
    }

    let out_path = PathBuf::from(&params.output_path);
    if let Some(parent) = out_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // 1. Copy cached audio stream to output location
    fs::copy(&cached_path, &out_path).map_err(|e| format!("复制音频文件失败: {}", e))?;

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
