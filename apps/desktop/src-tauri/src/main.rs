// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn clean_bloat_directories() {
  if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
    let ebwebview = std::path::PathBuf::from(local_app_data)
      .join("com.biliplayer.desktop")
      .join("EBWebView");
    let junk_dirs = [
      "component_crx_cache",
      "WidevineCdm",
      "Subresource Filter",
      "Speech Recognition",
      "hyphen-data",
      "BrowserMetrics",
    ];
    for junk in junk_dirs {
      let p = ebwebview.join(junk);
      if p.exists() {
        let _ = std::fs::remove_dir_all(p);
      }
    }
  }
}

fn main() {
  // 1. 启动时自动清理 WebView2 遗留的无用 CRX 组件与 DRM 缓存目录（防止 AppData 目录膨胀）
  clean_bloat_directories();

  // 2. 优化 WebView2 启动参数：
  // - 解除自动播放与后台定时器限制
  // - 限制磁盘网络缓存（100MB）与流媒体缓存（50MB）上限，超额自动 LRU 淘汰，杜绝无节制膨胀
  // - 禁用组件热更新（--disable-component-update），彻底防止后台偷偷下载几十兆 Widevine 等无关插件
  std::env::set_var(
    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required --disable-features=BlockInsecurePrivateNetworkRequests --disk-cache-size=104857600 --media-cache-size=52428800 --disable-component-update",
  );
  bili_player_lib::run();
}
