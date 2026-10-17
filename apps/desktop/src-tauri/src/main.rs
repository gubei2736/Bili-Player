// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // 禁用 WebView2 在失去焦点/后台时的节流和挂起，解除私有网络访问拦截与自动播放策略，确保音频平稳工作
  std::env::set_var(
    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required --disable-features=BlockInsecurePrivateNetworkRequests",
  );
  bili_player_lib::run();
}
