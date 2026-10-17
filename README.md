<div align="center">
<img src="./apps/desktop/public/icon.png" alt="logo" width="64" />
<h1>Bili Player</h1>

一款基于 **Tauri v2 + React 18 + Rust** 构建的高性能、轻量级本地优先 Bilibili PC 桌面音乐播放器。<br/>
提供纯粹、高音质、无冗余干扰的沉浸式听歌体验。


---

## 核心特性

### 极致播放体验
- **Bilibili 账号互通**：支持二维码扫码极速登录，无缝读取并同步个人收藏夹、合集订阅与追更列表。
- **Hi-Fi 级音频引擎**：基于 Web Audio API 深度调优，内置动态响度均衡（GainNode 自动补偿音量落差），呈现平滑细腻的高保真听感。
- **双模块智能搜索**：支持全网音视频搜索（精准识别 BV/AV 号与 b23.tv 短链解析），并提供个人收藏夹与媒体库实时快速检索。
- **内置迷你播放器**：支持一键开启画中画独立迷你悬浮窗，内置抽屉式播放队列展开、随心切歌与音量快速微调。

### 专业歌词系统
- **SPL 逐字动态歌词**：支持 SPL 规范逐字渲染、罗马音注音与翻译双行对照，亚像素级丝滑滚动显示。
- **桌面穿透悬浮歌词**：极简毛玻璃美学设计，支持窗口锁定、鼠标事件穿透、全屏应用自动规避与置顶切换。
- **多源智能匹配**：自动匹配多平台精校歌词，支持手动调整时间轴毫秒级偏移量。

### 本地化与音频导出
- **元数据无损导出**：支持一键将曲目导出为带高清专辑封面、ID3 元数据、内嵌歌词的 `.m4a` 音频文件。
- **自定义导出目录**：可在设置中心配置默认导出保存位置，并在导出弹窗中即时选择与持久化记忆。
- **100% 本地优先（Local-First）**：内置 SQLite 数据库，离线缓存、偏好配置、历史记录均存储于本地，启动迅速，零外部依赖。

### 桌面系统集成
- **原生系统托盘**：常驻 Windows 托盘，提供播放/暂停、切歌、显示主窗体及快速开关桌面歌词。
- **全局快捷键**：支持自定义全局系统级热键，游戏中或专注办公时无需切换窗口即可盲操控制。

---

## 技术栈与架构

- **桌面运行时**：[Tauri v2](https://v2.tauri.app/) (基于 Rust 驱动的高性能桌面框架)
- **前端视图**：React 18 + TypeScript + Vite + TailwindCSS
- **图标与动效**：Lucide Icons
- **本地数据库**：SQLite (通过 `@tauri-apps/plugin-sql` 驱动)
- **状态管理**：Zustand
- **原生能力扩展**：Rust（文件对话框 `rfd`、音频导出封装、全局快捷键、托盘管理）

---

## 项目结构 (Monorepo)

```text
Bili Player/
├── apps/
│   └── desktop/           # PC 桌面端核心 (Tauri v2 + React 18 + Rust)
├── packages/
│   ├── shared-core/       # 跨平台共享核心类型定义与 Bilibili 基础工具库
│   └── splash/            # SPL 逐字歌词与 LRC 歌词解析转换核心库
├── package.json           # 根目录工作区定义
├── pnpm-workspace.yaml    # pnpm monorepo 配置
└── README.md
```

---

## 开发与编译指南

### 前置环境需求
1. **Node.js** >= 18.0.0
2. **pnpm** >= 9.0.0
3. **Rust** 工具链（建议 1.75+，Windows 环境需包含 MSVC 工具链，如 Visual Studio Build Tools）

### 安装依赖
```bash
pnpm install
```

### 启动桌面端开发调试
```bash
pnpm --filter desktop tauri dev
```

### 构建生产环境可执行文件
```bash
pnpm --filter desktop tauri build
```
编译产物将输出至：
`apps/desktop/src-tauri/target/release/Bili Player.exe`

---

##  隐私与数据安全

Bili Player 是一款 **100% 本地优先、零数据上报、零遥测（No Telemetry）** 的纯净开源播放器：
-  **无第三方数据收集**：移除了所有第三方统计与分析平台（无 Firebase Analytics、无 Sentry 追踪）。
-  **本地私密存储**：账号登录凭证（Cookies）、收藏夹数据、播放记录及设置配置均存储于本地 SQLite 数据库与用户本地设备中。
-  **直接点对点交互**：所有网络交互均仅在客户端与 Bilibili 官方服务器之间点对点通信，无任何第三方服务器中转。



---

##  致敬与感谢

本项目的设计与实现离不开开源社区与前辈项目的启发，特别感谢：
- [BBPlayer](https://github.com/bbplayer-app/BBPlayer)
- [Bilibili](https://www.bilibili.com/)

---

## 📄 开源许可证

本项目基于 [MIT License] 许可开源。
