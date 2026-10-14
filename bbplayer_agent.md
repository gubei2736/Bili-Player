# AGENT EXECUTION SPEC: BBPlayer Desktop (Tauri v2) Migration

> **文档用途**：本文档为 AI Coding Agent（如 Cursor / Windsurf / Claude Code）的全局系统上下文与任务执行规范（`AGENT_SPEC.md`）。请严格按照本文档定义的架构边界、技术栈契约与分步指令执行代码生成与重构。

---

## 1. SYSTEM CONTEXT & ARCHITECTURE BOUNDARIES

### 1.1 项目背景与目标
将现有的 **BBPlayer**（基于 React Native + Expo 的 Bilibili 本地优先音乐播放器）移植为跨平台高颜值桌面端应用（Windows / macOS / Linux）。采用 **Monorepo 架构演进策略**，在原仓库新增 `apps/desktop`（基于 **Tauri v2 + Rust + React 18 + TypeScript + Vite**），最大化复用现有纯 TS 业务逻辑，并用 Rust + Web Audio API 彻底重写底层流媒体代理与音频播放引擎。

### 1.2 Monorepo 资产复用与重构映射表 (Asset Reuse Matrix)

| 原模块路径 | 功能职责 | Agent 处理策略 | 目标路径 (Target) |
| :--- | :--- | :--- | :--- |
| `packages/splash` | SPL 逐字歌词解析与转换引擎 | **100% 直接复用**（保持不变） | `@bbplayer/splash` |
| `packages/image-theme-colors` | 封面主色调提取算法 | **适配复用**：剥离原生图片加载器，暴露纯 RGBA 像素数组计算函数 | `@bbplayer/image-theme-colors` |
| `apps/mobile/src/api/*` | Bilibili API、WBI 签名、歌单匹配 | **抽离下沉**：解耦 RN 网络层，注入通用 `Fetcher` 接口 | `packages/shared-core/src/api/*` |
| `apps/mobile/src/db/*` | Drizzle ORM Schema 与查询语句 | **抽离下沉**：保留 Schema，解耦 `expo-sqlite` 驱动 | `packages/shared-core/src/db/*` |
| `apps/mobile/src/store/*` | Zustand 状态管理与 React Query | **抽离复用**：移除 `AsyncStorage`，抽象 `StateStorage` 接口 | `packages/shared-core/src/store/*` |
| `packages/orpheus` | Android Media3 播放引擎 (Kotlin) | **废弃重写（禁止在桌面端引用）** | 替换为 `apps/desktop` (Rust Proxy + Web Audio) |
| `packages/native` | Android Jetpack Compose / 悬浮窗 | **废弃重写（禁止在桌面端引用）** | 替换为 Tauri 多窗口 + Canvas UI |

### 1.3 目标目录结构规范 (Target Directory Tree)
Agent 在执行任务时，必须严格遵守以下目录拓扑：

```text
BBPlayer/
├── pnpm-workspace.yaml
├── packages/
│   ├── splash/                      # [Existing] SPL 歌词核心库
│   ├── shared-core/                 # [New] 跨端共享核心层 (纯 TS，零平台依赖)
│   │   ├── src/
│   │   │   ├── api/                 # WBI 签名、B站接口、外部歌单解析器
│   │   │   ├── db/                  # Drizzle ORM Schema 与通用 Queries
│   │   │   ├── stores/              # Zustand 状态机定义
│   │   │   └── types/               # 全局领域模型 (Track, Playlist, BiliGarb)
│   │   └── package.json
└── apps/
    ├── mobile/                      # [Existing] RN 移动端（改造为引用 @bbplayer/shared-core）
    └── desktop/                     # [New] Tauri v2 桌面端应用
        ├── src/                     # React 前端渲染进程
        │   ├── audio/               # Web Audio API 播放内核 (Orpheus 替代品)
        │   ├── components/
        │   │   ├── layout/          # 无边框标题栏、Mica侧边栏、三栏骨架、底栏
        │   │   ├── player/          # WavySlider(Canvas)、频谱渲染、全屏流体歌词视图
        │   │   └── ui/              # shadcn/ui (Radix + Tailwind) 基础组件
        │   ├── windows/
        │   │   ├── main/            # 主窗口路由与视图
        │   │   └── lyrics/          # 独立透明穿透桌面歌词窗口入口
        │   ├── db/                  # Drizzle 对接 @tauri-apps/plugin-sql 驱动适配
        │   └── hooks/               # Tauri IPC、SMTC 媒体控制、主题装扮动态注入
        └── src-tauri/               # Rust 核心主进程
            ├── Cargo.toml
            ├── tauri.conf.json      # 多窗口配置 (main + lyrics) 与权限声明
            └── src/
                ├── main.rs
                ├── lib.rs
                ├── stream_proxy.rs  # B站 DASH 音频流防盗链代理 + 边听边存缓存器
                ├── exporter.rs      # 纯 Rust (.m4s -> .m4a) 元数据与封面封装导出
                └── window_ext.rs    # window-vibrancy, window-shadows, 鼠标穿透控制
```

---

## 2. STRICT GUARDRAILS (Agent 编码红线与硬性约束)

1. **严禁跨端污染**：`packages/shared-core` 下**绝对禁止**出现任何 `react-native`、`expo-*`、`@tauri-apps/*` 或 Node.js `fs/path` 的直接导入。所有平台特定能力（HTTP 请求、SQLite 驱动、KV 存储）必须通过依赖注入（Dependency Injection）传入。
2. **严禁前端直接请求 B 站媒体流**：B 站音视频流（`.m4s`）有严格的 `Referer` 与 `User-Agent` 防盗链校验，禁止将原始 CDN URL 直接赋值给 `<audio src>`，必须统一经过 Rust 本地的回环流媒体代理或自定义协议。
3. **严禁高频 IPC 通信**：主窗口与桌面悬浮歌词窗口（`lyrics`）之间**禁止**通过 `emit` 广播高频 `timeupdate`（如每 16ms 一次）。只允许在歌曲切换、Play/Pause 状态改变、手动 Seek 校准时发送事件，桌面歌词窗口必须使用自身的 `requestAnimationFrame` + 本地时钟差值计算逐字渲染进度。
4. **严禁大面积使用 CSS `filter: blur()` 做动态背景**：为保障 macOS (`WKWebView`) 与 Windows (`WebView2`) 均达到 60/120fps 满帧，全屏歌词页的流体动态背景**必须**使用 HTML5 `<canvas>` 绘制低分辨率（如 $64 \times 64$）色块并放大渲染。
5. **严禁打包外部 FFmpeg 二进制文件**：`.m4a` 音频导出与元数据写入必须使用纯 Rust crate（如 `mp4ameta`）在内存中或流式完成，保持安装包体积在 `15MB` 以内。

---

## 3. CORE TECHNICAL CONTRACTS (核心模块实现契约)

### 3.1 契约一：Rust Bilibili DASH 流媒体代理与边听边存 (`src-tauri/src/stream_proxy.rs`)
* **输入参数**：`bvid: String`, `cid: u64`, `audio_url: String`
* **处理逻辑**：
  1. 在 Rust 端使用 `axum` 或 `tiny_http` 启动本地回环服务器 `http://127.0.0.1:{dynamic_port}/stream`。
  2. 接收前端 `<audio>` 发起的带 `Range: bytes=start-end` 的请求。
  3. 检查本地缓存目录 `$APP_CACHE_DIR/audio/{bvid}_{cid}.m4s` 是否已存在完整文件；若存在，直接读取本地文件响应 `206 Partial Content`。
  4. 若未缓存，使用 `reqwest::Client` 向上游 `audio_url` 发起请求，强制注入以下请求头：
     * `Referer: https://www.bilibili.com/video/{bvid}`
     * `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`
     * 透传前端的 `Range` 请求头。
  5. 以流式（Chunk Stream）将响应转发给前端，同时通过异步 `Tee` 流将分块落盘缓存。
  6. 响应头必须包含 `Access-Control-Allow-Origin: *`，以允许前端 Web Audio API 的 `MediaElementAudioSourceNode` 跨域读取音频采样数据进行频谱分析。

### 3.2 契约二：Web Audio API 播放引擎 (`apps/desktop/src/audio/DesktopAudioEngine.ts`)
替代原 `@bbplayer/orpheus`，必须实现以下接口契约：

```typescript
export interface AudioEngineContract {
  loadAndPlay(track: TrackMetadata, proxyStreamUrl: string, loudnessGainDb?: number): Promise<void>;
  play(): void;
  pause(): void;
  seek(timeInSeconds: number): void;
  setVolume(volume: number): void; // 0.0 to 1.0
  setLoudnessNormalization(enabled: boolean): void;
  getFrequencyData(buffer: Uint8Array): void; // 供 Canvas 律动频谱使用
  getCurrentTime(): number; // 精确到毫秒的高精度播放时间
}
```
* **Web Audio 节点拓扑图**：
  $$\text{HTMLAudioElement (crossOrigin="anonymous")} \longrightarrow \text{MediaElementAudioSourceNode} \longrightarrow \text{GainNode (响度均衡前置增益)} \longrightarrow \text{DynamicsCompressorNode (防爆音动态压缩)} \longrightarrow \text{AnalyserNode (FFT 频谱)} \longrightarrow \text{AudioContext.destination}$$
* **响度均衡公式**：若开启响度均衡且存在 B 站返回的响度差值 $\Delta L$ (dB)，则计算线性增益：
  $$\text{gain} = 10^{\frac{\Delta L}{20}}$$
  并通过 `gainNode.gain.setTargetAtTime(gain, audioCtx.currentTime, 0.015)` 平滑应用。

### 3.3 契约三：多窗口配置与穿透歌词同步 (`tauri.conf.json` & IPC)
* **窗口定义**：
  * `main` 窗口：`decorations: false`, `transparent: true`, `minWidth: 1020`, `minHeight: 680`。
  * `lyrics` 窗口：`decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: true`, `width: 800`, `height: 140`。
* **IPC 同步载荷 (`LyricsSyncPayload`)**：
  ```typescript
  export type LyricsSyncEvent =
    | { type: 'TRACK_CHANGE'; splContent: string; durationMs: number }
    | { type: 'STATE_SYNC'; isPlaying: boolean; currentTimeMs: number; timestamp: number }
    | { type: 'STYLE_UPDATE'; fontSize: number; primaryColor: string; lockMouse: boolean };
  ```
* **鼠标穿透控制**：当 `lockMouse: true` 时，调用 Tauri Rust/JS API `Window.setIgnoreCursorEvents(true)`；同时在系统托盘（Tray Menu）及全局快捷键（如 `Alt+Shift+L`）注册解锁回调 `setIgnoreCursorEvents(false)`。

### 3.4 契约四：高颜值 UI 与 B 站主题装扮引擎 (`apps/desktop/src/styles/`)
* **原生系统材质**：启动时在 Rust 端检测 OS，Windows 11 调用 `window_vibrancy::apply_mica`，macOS 调用 `window_vibrancy::apply_vibrancy(..., NSVisualEffectMaterial::Sidebar)`，并调用 `window_shadows::set_shadow(&window, true)`。
* **自定义组件要求**：
  * `WavySlider.tsx`：使用 `<canvas>` 绘制正弦波浪进度条，公式为 $y = A \cdot \sin(\omega x + \phi)$，播放时 $\phi$ 随时间递增产生流动动画，暂停时振幅 $A$ 平滑衰减至 $0$（变为直线）。支持在游标处渲染 B 站装扮的 Lottie/PNG 动态小电视挂件。
  * `FluidBackground.tsx`：提取当前歌曲封面的 4 个主色，在 `<canvas>` 上使用低频正弦轨迹移动 4 个径向渐变圆，开启重度模糊绘制，作为全屏歌词页底层背景。

---

## 4. STEP-BY-STEP EXECUTION PLAN (Agent 分步执行指令集)

> **Agent 执行法则**：请按顺序逐一执行以下 Phase。每完成一个 Task，运行对应的 Verification 命令，确认无误后将 `[ ]` 标记为 `[x]`，再进入下一阶段。

### Phase 1: Monorepo 抽离与共享核心包 (`packages/shared-core`) 构建
* [x] **Task 1.1**: 创建 `packages/shared-core`，配置 `package.json` 与 `tsconfig.json`。
* [x] **Task 1.2**: 将 `apps/mobile` 中的 WBI 签名算法、Bilibili API 请求模块（扫码登录、视频详情 `view`、音频流 `playurl`、收藏夹同步、装扮检索）以及网易云/QQ歌单解析逻辑迁移至 `packages/shared-core/src/api`。将底层 HTTP 调用抽象为 `HttpClient` 接口。
* [x] **Task 1.3**: 将 Drizzle ORM 的 Schema 定义（`tracks`, `playlists`, `playlist_tracks`, `history`, `lyrics_cache`）迁移至 `packages/shared-core/src/db/schema.ts`。
* [x] **Task 1.4**: 将播放队列管理、歌单状态、用户认证等 Zustand Stores 迁移至 `packages/shared-core/src/stores`。
* **Verification**: 运行 `pnpm --filter @bbplayer/shared-core typecheck`，确保零 TypeScript 错误且无任何 React Native 依赖。

### Phase 2: Tauri v2 桌面端脚手架与高颜值原生窗口初始化
* [ ] **Task 2.1**: 在 `apps/desktop` 初始化 Vite + React + TypeScript + Tailwind CSS + Tauri v2 项目，并在 `Cargo.toml` 中引入 `tauri-plugin-sql` (sqlite)、`tauri-plugin-store`、`tauri-plugin-global-shortcut`、`window-vibrancy`、`window-shadows`。
* [ ] **Task 2.2**: 编写 `src-tauri/src/window_ext.rs`，实现主窗口无边框圆角阴影、Win11 Mica / macOS Vibrancy 原生毛玻璃挂载，以及窗口最小化/最大化/关闭/鼠标穿透的 Tauri Commands。
* [ ] **Task 2.3**: 引入 `shadcn/ui` 基础组件与 `OverlayScrollbars`，构建桌面端三栏式主界面骨架（左侧毛玻璃导航栏 + 顶部吸顶搜索与自定义窗口控制栏 + 中间主内容区 + 底部胶囊播放控制栏）。
* [ ] **Task 2.4**: 配置 `@tauri-apps/plugin-sql` 驱动连接 `@bbplayer/shared-core/db`，跑通本地数据库自动迁移与歌单 CRUD。
* **Verification**: 运行 `pnpm --filter desktop tauri dev`，窗口正常启动，无边框毛玻璃与系统阴影生效，SQLite 建表成功。

### Phase 3: Rust 流媒体代理与 Web Audio 播放引擎实现
* [ ] **Task 3.1**: 在 `src-tauri/src/stream_proxy.rs` 中基于 `axum` 和 `reqwest` 实现本地流媒体代理服务，自动附加 B 站 `Referer`/`User-Agent`、支持 `HTTP Range (206)` 拖拽、附带 `Access-Control-Allow-Origin: *` 响应头，并实现音频流本地缓存落盘。
* [ ] **Task 3.2**: 编写 `apps/desktop/src/audio/DesktopAudioEngine.ts`，实现 HTML5 Audio + Web Audio API 管线（含响度均衡 `GainNode`、防爆音 `DynamicsCompressorNode`、频谱分析 `AnalyserNode`）。
* [ ] **Task 3.3**: 接入 `navigator.mediaSession` API，绑定系统级媒体控制（SMTC / macOS Control Center）与封面元数据展示。
* [ ] **Task 3.4**: 使用 HTML5 Canvas 实现 `WavySlider.tsx`（动态波浪进度条）与封面音频律动光晕组件，并与 `DesktopAudioEngine` 状态绑定。
* **Verification**: 在搜索框输入任意 B 站 BV 号或 `b23.tv` 短链，能够成功解析出音频并流畅播放，拖拽波浪进度条立即响应（`206 Partial Content`），开启/关闭响度均衡音量平滑过渡。

### Phase 4: SPL 沉浸式全屏歌词与独立穿透桌面歌词窗口
* [ ] **Task 4.1**: 开发 `FluidBackground.tsx`（Canvas 封面主色流体渐变背景）与 `ImmersiveLyricsView.tsx`（使用 Framer Motion 实现点击左下角封面平滑展开全屏，接入 `@bbplayer/splash` 渲染逐字音节染色、罗马音、双语翻译及远近景深模糊动效）。
* [ ] **Task 4.2**: 在 `tauri.conf.json` 中注册 `lyrics` 独立透明置顶窗口，编写 `apps/desktop/src/windows/lyrics/DesktopLyricsApp.tsx`。
* [ ] **Task 4.3**: 实现主窗口与 `lyrics` 窗口的 `LyricsSyncEvent` IPC 同步机制，以及系统托盘菜单（显示/隐藏歌词、锁定/穿透鼠标点击、退出应用）。
* **Verification**: 展开全屏歌词页帧率稳定在 60fps+；开启桌面悬浮歌词并点击“锁定”，鼠标可穿透歌词正常点击后方桌面窗口，逐字高亮与音频严密同步。

### Phase 5: 歌单迁移、B站主题装扮与纯 Rust `.m4a` 导出
* [ ] **Task 5.1**: 在桌面端 UI 接入 `@bbplayer/shared-core` 的 B 站扫码登录、云端收藏夹同步、以及网易云/QQ音乐歌单智能匹配导入向导弹窗，并构建播放历史热力图统计面板。
* [ ] **Task 5.2**: 接入 B 站装扮主题引擎，支持搜索并应用 B 站装扮包（动态注入 CSS 主题色变量、主视图背景图叠加、波浪进度条动态游标挂件）。
* [ ] **Task 5.3**: 在 `src-tauri/src/exporter.rs` 中引入 `mp4ameta` crate，编写 `export_cached_track_to_m4a` Command，将缓存的 `.m4s` 音频流封装为标准 `.m4a` 文件，并内嵌高清封面二进制、歌名、UP主名称与 LRC/SPL 歌词文本。
* **Verification**: 导出缓存歌曲至本地桌面，使用系统自带音乐播放器打开该 `.m4a` 文件，音频正常播放且封面、歌手、内嵌歌词完整显示。