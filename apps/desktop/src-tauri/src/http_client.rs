use reqwest::header::{HeaderMap, HeaderName, HeaderValue, SET_COOKIE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
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

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_reqwest_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        let mut builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            // 不自动跟随重定向，以便手动拦截捕获 302 跨域换票响应头中的 Set-Cookie
            .redirect(reqwest::redirect::Policy::none());

        if let Ok(proxy_val) = std::env::var("HTTP_PROXY").or_else(|_| std::env::var("http_proxy")) {
            if let Ok(proxy) = reqwest::Proxy::all(&proxy_val) {
                builder = builder.proxy(proxy);
            }
        }

        builder.build().unwrap_or_else(|_| reqwest::Client::new())
    })
}

#[tauri::command]
pub async fn native_http_request(request: NativeHttpRequest) -> Result<NativeHttpResponse, String> {
    let client = get_reqwest_client();
    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_uppercase();

    let mut current_url = request.url.clone();
    let mut all_set_cookies: Vec<String> = Vec::new();
    let mut redirect_count = 0;

    loop {
        let req_builder = match method.as_str() {
            "POST" => client.post(&current_url),
            "PUT" => client.put(&current_url),
            "DELETE" => client.delete(&current_url),
            "HEAD" => client.head(&current_url),
            _ => client.get(&current_url),
        };

        let mut header_map = HeaderMap::new();
        if let Some(ref headers) = request.headers {
            for (k, v) in headers {
                if let (Ok(hn), Ok(hv)) = (
                    HeaderName::from_bytes(k.as_bytes()),
                    HeaderValue::from_str(v),
                ) {
                    header_map.insert(hn, hv);
                }
            }
        }

        // 如果在前面的重定向跃点中捕获到了 Cookie，且当前请求未设置 Cookie，则自动透传
        if !all_set_cookies.is_empty() && !header_map.contains_key("cookie") {
            let cookie_parts: Vec<String> = all_set_cookies
                .iter()
                .filter_map(|c| c.split(';').next().map(|p| p.trim().to_string()))
                .collect();
            if !cookie_parts.is_empty() {
                if let Ok(cv) = HeaderValue::from_str(&cookie_parts.join("; ")) {
                    header_map.insert(HeaderName::from_static("cookie"), cv);
                }
            }
        }

        let mut req_builder = req_builder.headers(header_map);
        if redirect_count == 0 {
            if let Some(ref body_str) = request.body {
                req_builder = req_builder.body(body_str.clone());
            }
        }

        let response = req_builder.send().await.map_err(|e| e.to_string())?;
        let status = response.status();

        // 收集当前响应中的所有 Set-Cookie
        for val in response.headers().get_all(SET_COOKIE).iter() {
            if let Ok(val_str) = val.to_str() {
                all_set_cookies.push(val_str.to_string());
            }
        }

        // 手动处理 301/302/303/307/308 重定向，保留各级跃点的全部 Set-Cookie
        if status.is_redirection() && redirect_count < 5 {
            if let Some(loc) = response.headers().get(reqwest::header::LOCATION) {
                if let Ok(loc_str) = loc.to_str() {
                    current_url = if loc_str.starts_with("http://") || loc_str.starts_with("https://") {
                        loc_str.to_string()
                    } else if loc_str.starts_with('/') {
                        let base_url = reqwest::Url::parse(&current_url).map_err(|e| e.to_string())?;
                        format!("{}://{}{}", base_url.scheme(), base_url.host_str().unwrap_or(""), loc_str)
                    } else {
                        loc_str.to_string()
                    };
                    redirect_count += 1;
                    continue;
                }
            }
        }

        let status_code = status.as_u16();
        let status_text = status.canonical_reason().unwrap_or("").to_string();
        let ok = status.is_success() || status.is_redirection();

        let mut resp_headers = HashMap::new();
        for (name, val) in response.headers().iter() {
            let name_str = name.as_str().to_lowercase();
            if name != SET_COOKIE {
                if let Ok(val_str) = val.to_str() {
                    resp_headers.insert(name_str, val_str.to_string());
                }
            }
        }

        if !all_set_cookies.is_empty() {
            // 使用换行符分隔不同的 Set-Cookie，防止与单个 Cookie 内的 ';' 混淆
            resp_headers.insert("set-cookie".to_string(), all_set_cookies.join("\n"));
        }

        let body = response.text().await.map_err(|e| e.to_string())?;

        return Ok(NativeHttpResponse {
            ok,
            status: status_code,
            status_text,
            headers: resp_headers,
            body,
        });
    }
}
