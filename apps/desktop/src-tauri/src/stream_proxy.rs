use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use futures_util::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;
use tokio::fs::{self, File};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom};
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

pub static PROXY_PORT: AtomicU16 = AtomicU16::new(0);

#[tauri::command]
pub fn get_stream_proxy_port() -> u16 {
    PROXY_PORT.load(Ordering::Relaxed)
}

#[tauri::command]
pub async fn get_cached_track_path(
    app: tauri::AppHandle,
    bvid: String,
    cid: u64,
) -> Result<Option<String>, String> {
    use tauri::Manager;
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("audio_cache");
    let path = cache_dir.join(format!("{}_{}.m4s", bvid, cid));
    if path.exists() && fs::metadata(&path).await.map(|m| m.len() > 0).unwrap_or(false) {
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[derive(Clone)]
pub struct ProxyState {
    direct_client: Client,
    proxy_client: Option<Client>,
    pub cache_dir: std::path::PathBuf,
}

#[derive(Deserialize)]
pub struct ProxyParams {
    pub url: String,
    pub bvid: Option<String>,
    pub cid: Option<u64>,
}

async fn serve_cached_file(
    file_path: std::path::PathBuf,
    range_header: Option<&axum::http::HeaderValue>,
) -> Result<Response, (StatusCode, String)> {
    crate::window_ext::write_log_line(&format!("[StreamProxy Cache] Serving from disk: {:?}", file_path));
    let mut file = File::open(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let total_len = file
        .metadata()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .len();

    let (start, end, status) = if let Some(range_val) = range_header {
        if let Ok(range_str) = range_val.to_str() {
            if let Some(spec) = range_str.strip_prefix("bytes=") {
                let parts: Vec<&str> = spec.split('-').collect();
                let s = parts[0].parse::<u64>().unwrap_or(0);
                let e = if parts.len() > 1 && !parts[1].is_empty() {
                    parts[1].parse::<u64>().unwrap_or(total_len - 1)
                } else {
                    total_len - 1
                };
                (s, e.min(total_len - 1), StatusCode::PARTIAL_CONTENT)
            } else {
                (0, total_len - 1, StatusCode::OK)
            }
        } else {
            (0, total_len - 1, StatusCode::OK)
        }
    } else {
        (0, total_len - 1, StatusCode::OK)
    };

    let content_len = end - start + 1;
    file.seek(SeekFrom::Start(start))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let stream = tokio_util::io::ReaderStream::new(file.take(content_len));
    let body = Body::from_stream(stream);

    let mut builder = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "audio/mp4")
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .header(header::ACCESS_CONTROL_EXPOSE_HEADERS, "*")
        .header("Access-Control-Allow-Private-Network", "true")
        .header(header::CONTENT_LENGTH, content_len.to_string());

    if status == StatusCode::PARTIAL_CONTENT {
        builder = builder.header(
            header::CONTENT_RANGE,
            format!("bytes {}-{}/{}", start, end, total_len),
        );
    }

    builder
        .body(body)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn proxy_handler(
    State(state): State<Arc<ProxyState>>,
    headers: HeaderMap,
    Query(params): Query<ProxyParams>,
) -> Result<Response, (StatusCode, String)> {
    crate::window_ext::write_log_line(&format!(
        "[StreamProxy] >>> GET /proxy | bvid={:?}, cid={:?}, Range={:?}",
        params.bvid,
        params.cid,
        headers.get(header::RANGE).and_then(|v| v.to_str().ok())
    ));

    let cache_dir = state.cache_dir.join("audio_cache");
    let target_cache_file = if let Some(ref bvid) = params.bvid {
        let cid_val = params.cid.unwrap_or(0);
        let path = cache_dir.join(format!("{}_{}.m4s", bvid, cid_val));
        if path.exists() && fs::metadata(&path).await.map(|m| m.len() > 0).unwrap_or(false) {
            return serve_cached_file(path, headers.get(header::RANGE)).await;
        }
        Some(path)
    } else {
        None
    };

    let send_upstream = |client: &Client| {
        let mut req = client
            .get(&params.url)
            .header(header::REFERER, "https://www.bilibili.com/")
            .header(
                header::USER_AGENT,
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            );
        if let Some(range) = headers.get(header::RANGE) {
            req = req.header(header::RANGE, range);
        }
        req.send()
    };

    let upstream = match send_upstream(&state.direct_client).await {
        Ok(res) if res.status().is_success() || res.status().as_u16() == 206 => res,
        Ok(res) => {
            crate::window_ext::write_log_line(&format!(
                "[StreamProxy WARNING] Direct request returned status {}. Checking proxy fallback...",
                res.status()
            ));
            if let Some(ref p_client) = state.proxy_client {
                if let Ok(p_res) = send_upstream(p_client).await {
                    if p_res.status().is_success() || p_res.status().as_u16() == 206 {
                        crate::window_ext::write_log_line("[StreamProxy] Proxy fallback succeeded!");
                        p_res
                    } else {
                        res
                    }
                } else {
                    res
                }
            } else {
                res
            }
        }
        Err(e) => {
            crate::window_ext::write_log_line(&format!(
                "[StreamProxy ERROR] Direct upstream request failed: {}. Trying proxy fallback...",
                e
            ));
            if let Some(ref p_client) = state.proxy_client {
                match send_upstream(p_client).await {
                    Ok(p_res) => {
                        crate::window_ext::write_log_line("[StreamProxy] Proxy fallback request succeeded!");
                        p_res
                    }
                    Err(p_err) => {
                        crate::window_ext::write_log_line(&format!(
                            "[StreamProxy ERROR] Proxy fallback also failed: {}",
                            p_err
                        ));
                        return Err((StatusCode::BAD_GATEWAY, format!("All upstream attempts failed: direct={}, proxy={}", e, p_err)));
                    }
                }
            } else {
                return Err((StatusCode::BAD_GATEWAY, e.to_string()));
            }
        }
    };

    let status = StatusCode::from_u16(upstream.status().as_u16())
        .unwrap_or(StatusCode::OK);

    crate::window_ext::write_log_line(&format!(
        "[StreamProxy] <<< Upstream responded: HTTP {} | Content-Length: {:?} | Content-Type: {:?}",
        status,
        upstream.headers().get(header::CONTENT_LENGTH).and_then(|v| v.to_str().ok()),
        upstream.headers().get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok()),
    ));

    let mut response_builder = Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .header(header::ACCESS_CONTROL_EXPOSE_HEADERS, "*")
        .header("Access-Control-Allow-Private-Network", "true")
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_TYPE, "audio/mp4");

    if let Some(cr) = upstream.headers().get(header::CONTENT_RANGE) {
        response_builder = response_builder.header(header::CONTENT_RANGE, cr);
    }

    if let Some(cl) = upstream.headers().get(header::CONTENT_LENGTH) {
        response_builder = response_builder.header(header::CONTENT_LENGTH, cl);
    }

    // Stream and optionally cache to disk if this is a full stream request
    let is_range = headers.contains_key(header::RANGE);
    if !is_range && target_cache_file.is_some() {
        let cache_path = target_cache_file.unwrap();
        let _ = fs::create_dir_all(&cache_dir).await;
        let part_path = cache_path.with_extension("m4s.part");

        let mut upstream_stream = upstream.bytes_stream();
        let (tx, rx) = tokio::sync::mpsc::channel::<Result<bytes::Bytes, std::io::Error>>(32);

        tokio::spawn(async move {
            let mut file_opt = File::create(&part_path).await.ok();
            let mut aborted = false;
            while let Some(chunk_res) = upstream_stream.next().await {
                match chunk_res {
                    Ok(bytes) => {
                        if let Some(ref mut f) = file_opt {
                            let _ = f.write_all(&bytes).await;
                        }
                        if tx.send(Ok(bytes)).await.is_err() {
                            // Downstream receiver disconnected early
                            aborted = true;
                            break;
                        }
                    }
                    Err(e) => {
                        let _ = tx
                            .send(Err(std::io::Error::new(
                                std::io::ErrorKind::Other,
                                e.to_string(),
                            )))
                            .await;
                        aborted = true;
                        break;
                    }
                }
            }

            if let Some(mut f) = file_opt {
                let _ = f.flush().await;
                drop(f);
                if !aborted {
                    let _ = fs::rename(&part_path, &cache_path).await;
                } else {
                    let _ = fs::remove_file(&part_path).await;
                }
            }
        });

        let body = Body::from_stream(tokio_stream::wrappers::ReceiverStream::new(rx));
        return response_builder
            .body(body)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
    }

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream);

    response_builder
        .body(body)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn options_handler() -> Response {
    crate::window_ext::write_log_line("[StreamProxy] >>> OPTIONS /proxy (PNA preflight request received)");
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .header(header::ACCESS_CONTROL_EXPOSE_HEADERS, "*")
        .header("Access-Control-Allow-Private-Network", "true")
        .body(Body::empty())
        .unwrap()
}

/// Spawns the local Axum proxy server on loopback, binding to an ephemeral port.
pub async fn start_proxy_server(
    cache_dir: std::path::PathBuf,
) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
    let direct_client = Client::builder()
        .no_proxy()
        .connect_timeout(std::time::Duration::from_secs(6))
        .build()
        .unwrap_or_else(|_| Client::new());

    let is_7879_active = std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], 7879)),
        std::time::Duration::from_millis(50),
    )
    .is_ok();

    let proxy_client = if is_7879_active {
        if let Ok(proxy) = reqwest::Proxy::all("http://127.0.0.1:7879") {
            Client::builder()
                .proxy(proxy)
                .connect_timeout(std::time::Duration::from_secs(6))
                .build()
                .ok()
        } else {
            None
        }
    } else {
        None
    };

    crate::window_ext::write_log_line(&format!(
        "[StreamProxy] Initializing Axum proxy. Direct client ready, 7879 proxy available: {}",
        proxy_client.is_some()
    ));

    let state = Arc::new(ProxyState {
        direct_client,
        proxy_client,
        cache_dir,
    });

    let app = Router::new()
        .route("/proxy", get(proxy_handler).options(options_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    PROXY_PORT.store(port, Ordering::Relaxed);

    crate::window_ext::write_log_line(&format!(
        "[StreamProxy] Local streaming proxy successfully bound to http://127.0.0.1:{}",
        port
    ));

    tokio::spawn(async move {
        if let Err(err) = axum::serve(listener, app).await {
            crate::window_ext::write_log_line(&format!("[StreamProxy Server Error] {}", err));
        }
    });

    Ok(port)
}
