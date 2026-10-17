// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // 禁用 WebView2 在失去焦点/后台时的节流和挂起，确保全局快捷键与音频后台平稳工作
  std::env::set_var(
    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows",
  );
  bili_player_lib::run();
}
