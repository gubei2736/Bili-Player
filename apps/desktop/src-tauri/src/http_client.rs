use reqwest::header::{HeaderMap, HeaderName, HeaderValue, SET_COOKIE};
use reqwest::StatusCode;
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

static DIRECT_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static PROXY_CLIENT_7879: OnceLock<reqwest::Client> = OnceLock::new();
static PROXY_CLIENT_ENV: OnceLock<Option<reqwest::Client>> = OnceLock::new();

fn get_direct_client() -> &'static reqwest::Client {
    DIRECT_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_millis(2000))
            .timeout(Duration::from_secs(8))
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

fn get_active_proxy_client() -> Option<&'static reqwest::Client> {
    // 1. 动态检测本地代理端口 127.0.0.1:7879 是否在监听（探测耗时通常 <0.5ms）
    let is_7879_active = std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], 7879)),
        Duration::from_millis(50),
    )
    .is_ok();

    if is_7879_active {
        return Some(PROXY_CLIENT_7879.get_or_init(|| {
            let proxy = reqwest::Proxy::all("http://127.0.0.1:7879")
                .expect("valid static proxy string");
            reqwest::Client::builder()
                .connect_timeout(Duration::from_millis(2000))
                .timeout(Duration::from_secs(8))
                .proxy(proxy)
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap_or_else(|_| reqwest::Client::new())
        }));
    }

    // 2. 环境代理变量检测
    PROXY_CLIENT_ENV
        .get_or_init(|| {
            let env_proxy = std::env::var("HTTP_PROXY")
                .or_else(|_| std::env::var("http_proxy"))
                .or_else(|_| std::env::var("ALL_PROXY"))
                .or_else(|_| std::env::var("all_proxy"))
                .ok();

            if let Some(ref p) = env_proxy {
                if let Ok(proxy) = reqwest::Proxy::all(p) {
                    return reqwest::Client::builder()
                        .connect_timeout(Duration::from_millis(2000))
                        .timeout(Duration::from_secs(8))
                        .proxy(proxy)
                        .redirect(reqwest::redirect::Policy::none())
                        .build()
                        .ok();
                }
            }
            None
        })
        .as_ref()
}

async fn execute_request_on_client(
    client: &reqwest::Client,
    request: &NativeHttpRequest,
) -> Result<NativeHttpResponse, String> {
    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_uppercase();

    let mut current_method = method;
    let mut current_url = request.url.clone();
    let mut all_set_cookies: Vec<String> = Vec::new();
    let mut redirect_count = 0;

    loop {
        let req_builder = match current_method.as_str() {
            "POST" => client.post(&current_url),
            "PUT" => client.put(&current_url),
            "DELETE" => client.delete(&current_url),
            "HEAD" => client.head(&current_url),
            _ => client.get(&current_url),
        };

        let mut header_map = HeaderMap::new();
        if let Some(ref headers) = request.headers {
            for (k, v) in headers {
                let lower_k = k.to_lowercase();
                if let (Ok(hn), Ok(hv)) = (
                    HeaderName::from_bytes(lower_k.as_bytes()),
                    HeaderValue::from_str(v),
                ) {
                    header_map.insert(hn, hv);
                }
            }
        }

        // 默认补充浏览器 User-Agent，避免防爬系统丢弃无头请求
        if !header_map.contains_key("user-agent") {
            if let Ok(ua_val) = HeaderValue::from_str(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ) {
                header_map.insert(HeaderName::from_static("user-agent"), ua_val);
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
        if redirect_count == 0 && current_method != "GET" && current_method != "HEAD" {
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
                    } else if let Ok(base_url) = reqwest::Url::parse(&current_url) {
                        base_url
                            .join(loc_str)
                            .map(|u| u.to_string())
                            .unwrap_or_else(|_| loc_str.to_string())
                    } else {
                        loc_str.to_string()
                    };

                    // HTTP 标准：301/302/303 重定向时将 POST 转为 GET
                    if matches!(
                        status,
                        StatusCode::MOVED_PERMANENTLY
                            | StatusCode::FOUND
                            | StatusCode::SEE_OTHER
                    ) && current_method == "POST"
                    {
                        current_method = "GET".to_string();
                    }

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

#[tauri::command]
pub async fn native_http_request(request: NativeHttpRequest) -> Result<NativeHttpResponse, String> {
    // 1. 若本地代理端口 127.0.0.1:7879 或环境变量代理可用（如 Clash 正在运行将域名劫持为 Fake-IP），
    // 必须优先使用代理通道。Clash 内核在本地即可瞬间完成路由和请求（耗时约 50ms），
    // 彻底杜绝直接向 Fake-IP 黑洞发包造成的长达数秒挂起超时！
    if let Some(proxy_client) = get_active_proxy_client() {
        if let Ok(proxy_res) = execute_request_on_client(proxy_client, &request).await {
            if proxy_res.ok || (proxy_res.status > 0 && proxy_res.status < 500) {
                return Ok(proxy_res);
            }
        }
    }

    // 2. 直连通道（代理未开启、或代理请求失败时执行）
    execute_request_on_client(get_direct_client(), &request).await
}
