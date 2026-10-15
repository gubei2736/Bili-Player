# Bili Player 桌面悬浮歌词模块（审视包）

本目录（`other/`）专用于向架构师、其他 AI 助手或开发者完整呈现 **Bili Player 桌面歌词（Desktop Floating Lyrics）** 的实现全貌。

---

## 目录索引与导航

- 📘 **全景架构与技术方案文档**：
  - [`ARCHITECTURE_DESKTOP_LYRICS.md`](./ARCHITECTURE_DESKTOP_LYRICS.md)：详细阐述了 Tauri 多窗口体系、OS 级鼠标穿透机制、四维解锁策略、IPC 协议设计、逐字动效算法及供 AI 审视的核心技术关注点。

- 💻 **前端与独立窗口源码**：
  - [`src/windows/lyrics/DesktopLyricsApp.tsx`](./src/windows/lyrics/DesktopLyricsApp.tsx)：桌面歌词独立窗口组件实现（逐字高亮渲染、双语与罗马音排版、透明悬浮、状态处理）。
  - [`src/main.tsx`](./src/main.tsx)：前端单页面应用的 Hash 路由分流入口（`#lyrics` 分流加载 `DesktopLyricsApp`）。
  - [`src/App_lyrics_snippet.tsx`](./src/App_lyrics_snippet.tsx)：主窗口向桌面歌词广播高频音频进度与曲目元信息的核心代码片段。
  - [`src/components/BottomPlayerBar_lyrics_snippet.tsx`](./src/components/BottomPlayerBar_lyrics_snippet.tsx)：底栏控制条上的左键开启/关闭与右键锁定交互逻辑。
  - [`src/services/lyricService.ts`](./src/services/lyricService.ts)：多源歌词抓取引擎（QQ 音乐优先，网易云音乐补充罗马音与翻译的跨源融合算法）。

- 🦀 **Rust 原生后端源码**：
  - [`src-tauri/window_ext.rs`](./src-tauri/window_ext.rs)：Windows OS 级原生窗口控制，包括 `set_ignore_cursor_events` 穿透设置与窗口显隐。
  - [`src-tauri/shortcuts.rs`](./src-tauri/shortcuts.rs)：全局热键 `Ctrl+Alt+L`（锁定/解锁）与 `Ctrl+Alt+D`（显示/隐藏）的底层拦截与状态同步。
  - [`src-tauri/lib.rs`](./src-tauri/lib.rs)：系统托盘菜单与 Tauri 宿主初始化命令注册。
  - [`src-tauri/tauri.conf.json`](./src-tauri/tauri.conf.json)：桌面歌词独立窗口的配置元数据（透明窗口、常驻置顶、跳过任务栏等）。

---

## 给外部 AI / 评审者的提示（Prompt 示例）

若需要将本目录提供给其他 AI 审视，可直接附带如下 Prompt：

> "请阅读 `other/ARCHITECTURE_DESKTOP_LYRICS.md` 以及 `other/` 目录下的相关源码，审视当前桌面歌词架构在以下方面的合理性与潜在风险，并给出优化建议：
> 1. Tauri v2 多窗口架构下的 IPC 高频同步开销与逐字动画平滑度（200ms 节流 vs 前端时钟插值）；
> 2. Windows 系统级鼠标穿透（`WS_EX_TRANSPARENT`）与多通道解锁机制的鲁棒性；
> 3. 多源（QQ 音乐 + 网易云）跨平台歌词、翻译与罗马音融合算法的时间轴对齐容差与网络异常降级方案。"
