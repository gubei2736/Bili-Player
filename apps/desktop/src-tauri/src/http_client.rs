use reqwest::header::{HeaderMap, HeaderName, HeaderValue, SET_COOKIE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct NativeHttpRequest {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NativeHttpResponse {
    pub ok: bool,
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

fn build_reqwest_client() -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(10));

    // Support local proxy 127.0.0.1:7879 if configured or env set
    if let Ok(proxy_val) = std::env::var("HTTP_PROXY").or_else(|_| std::env::var("http_proxy")) {
        if let Ok(proxy) = reqwest::Proxy::all(&proxy_val) {
            builder = builder.proxy(proxy);
        }
    }

    builder.build().unwrap_or_else(|_| reqwest::Client::new())
}

#[tauri::command]
pub async fn native_http_request(request: NativeHttpRequest) -> Result<NativeHttpResponse, String> {
    let client = build_reqwest_client();
    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_uppercase();

    let req_builder = match method.as_str() {
        "POST" => client.post(&request.url),
        "PUT" => client.put(&request.url),
        "DELETE" => client.delete(&request.url),
        "HEAD" => client.head(&request.url),
        _ => client.get(&request.url),
    };

    let mut header_map = HeaderMap::new();
    if let Some(headers) = request.headers {
        for (k, v) in headers {
            if let (Ok(hn), Ok(hv)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(&v),
            ) {
                header_map.insert(hn, hv);
            }
        }
    }

    let mut req_builder = req_builder.headers(header_map);
    if let Some(body_str) = request.body {
        req_builder = req_builder.body(body_str);
    }

    let response = req_builder.send().await.map_err(|e| e.to_string())?;

    let status = response.status();
    let status_code = status.as_u16();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let ok = status.is_success();

    let mut resp_headers = HashMap::new();
    let mut set_cookies = Vec::new();

    for (name, val) in response.headers().iter() {
        let name_str = name.as_str().to_lowercase();
        if let Ok(val_str) = val.to_str() {
            if name == SET_COOKIE {
                set_cookies.push(val_str.to_string());
            } else {
                resp_headers.insert(name_str, val_str.to_string());
            }
        }
    }

    if !set_cookies.is_empty() {
        resp_headers.insert("set-cookie".to_string(), set_cookies.join("; "));
    }

    let body = response.text().await.map_err(|e| e.to_string())?;

    Ok(NativeHttpResponse {
        ok,
        status: status_code,
        status_text,
        headers: resp_headers,
        body,
    })
}
