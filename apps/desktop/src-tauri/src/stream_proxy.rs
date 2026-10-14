use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use reqwest::Client;
use serde::Deserialize;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

pub static PROXY_PORT: AtomicU16 = AtomicU16::new(0);

#[tauri::command]
pub fn get_stream_proxy_port() -> u16 {
    PROXY_PORT.load(Ordering::Relaxed)
}

#[derive(Clone)]
pub struct ProxyState {
    client: Client,
    pub cache_dir: std::path::PathBuf,
}

#[derive(Deserialize)]
pub struct ProxyParams {
    pub url: String,
    pub bvid: Option<String>,
    pub cid: Option<u64>,
}

async fn proxy_handler(
    State(state): State<Arc<ProxyState>>,
    headers: HeaderMap,
    Query(params): Query<ProxyParams>,
) -> Result<Response, (StatusCode, String)> {
    let mut req = state
        .client
        .get(&params.url)
        .header(header::REFERER, "https://www.bilibili.com/")
        .header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );

    // Forward Range header if present (for seeking / 206 Partial Content)
    if let Some(range) = headers.get(header::RANGE) {
        req = req.header(header::RANGE, range);
    }

    let upstream = req
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    let status = StatusCode::from_u16(upstream.status().as_u16())
        .unwrap_or(StatusCode::OK);

    let mut response_builder = Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .header(header::ACCESS_CONTROL_EXPOSE_HEADERS, "*")
        .header(header::ACCEPT_RANGES, "bytes");

    if let Some(ct) = upstream.headers().get(header::CONTENT_TYPE) {
        response_builder = response_builder.header(header::CONTENT_TYPE, ct);
    } else {
        response_builder = response_builder.header(header::CONTENT_TYPE, "audio/mp4");
    }

    if let Some(cr) = upstream.headers().get(header::CONTENT_RANGE) {
        response_builder = response_builder.header(header::CONTENT_RANGE, cr);
    }

    if let Some(cl) = upstream.headers().get(header::CONTENT_LENGTH) {
        response_builder = response_builder.header(header::CONTENT_LENGTH, cl);
    }

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream);

    response_builder
        .body(body)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

/// Spawns the local Axum proxy server on loopback, binding to an ephemeral port.
pub async fn start_proxy_server(
    cache_dir: std::path::PathBuf,
) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
    let state = Arc::new(ProxyState {
        client: Client::builder().build()?,
        cache_dir,
    });

    let app = Router::new()
        .route("/proxy", get(proxy_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    PROXY_PORT.store(port, Ordering::Relaxed);

    tokio::spawn(async move {
        if let Err(err) = axum::serve(listener, app).await {
            log::error!("Proxy server error: {}", err);
        }
    });

    Ok(port)
}
