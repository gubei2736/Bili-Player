<div align="center">

<img src="apps/desktop/public/icon.png" alt="Bili Player Logo" width="80" />

# Bili Player

一款基于 **Tauri v2 + React 18 + Rust** 构建的轻量级本地优先 Bilibili PC 桌面音乐播放器。  
提供简洁、无广告干扰的桌面听歌与音频管理环境。

<p>
  <a href="https://github.com/gubei2736">
    <img src="https://github.com/gubei2736.png" width="48" height="48" alt="gubei2736" style="border-radius: 50%;" />
  </a>
  <br />
  <sub><b>Author & Maintainer: <a href="https://github.com/gubei2736">gubei2736</a></b></sub>
</p>

[![Release](https://img.shields.io/badge/Release-v1.1.0-blue?style=flat-square)](https://github.com/gubei2736/Bili-Player/releases)
[![Maintainer](https://img.shields.io/badge/Maintainer-gubei2736-EA4AAA?style=flat-square&logo=github&logoColor=white)](https://github.com/gubei2736)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/gubei2736/Bili-Player)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## 功能特性

### 音频播放与音质管理
- **账号同步**：支持二维码扫码登录，自动同步账号内的个人收藏夹、合集与订阅列表。
- **音质档位选择**：支持切换高音质、无损及 B 站原声规格音轨。
- **Web Audio 响度均衡**：利用 Web Audio API 的 GainNode 动态平衡不同视频之间的音量落差，避免忽大忽小。
- **播放模式控制**：提供列表循环、单曲循环、随机播放及顺序播放模式。
- **播放队列管理**：支持抽屉式展开播放列表、拖拽排序、快速移除单曲与一键清空。
- **多分 P 选集解析**：支持多 Part 视频解析，提供分集列表弹窗，支持单独点播或整组加入队列。
- **断点续播**：自动记忆上次播放进度与曲目状态。

### 歌词系统
- **动态逐字歌词**：支持 SPL 格式逐字精准高亮渲染及常规 LRC 滚动歌词。
- **双语与注音对照**：支持歌词翻译与罗马音注音对照展示。
- **沉浸式全屏歌词页**：支持进入大屏全屏歌词模式，配合背景流体微动与大封面显示。
- **多源匹配与搜索**：自动匹配多平台精校歌词，支持手动调整时间轴毫秒级偏移量。
- **独立桌面悬浮歌词**：提供独立的无边框半透明桌面歌词窗口，支持鼠标事件穿透、窗口锁定置顶以及全屏应用自动避让。

### 迷你播放器 (Mini Player)
- **画中画悬浮窗**：轻量级独立小窗，支持置顶停靠在桌面任意位置。
- **完整播放控制**：在迷你窗口中直接进行切歌、暂停、进度与音量调节。
- **内置列表抽屉**：支持在小窗内即时展开播放队列，无需唤回主窗口即可切换曲目。

### 检索与外部歌单导入
- **智能综合搜索**：支持搜索歌曲名、UP 主，并可直接粘贴 BV 号、AV 号及 b23.tv 短链接快速解析播放。
- **媒体库内检索**：支持对个人收藏夹与自定义歌单内容进行本地实时关键词过滤。
- **外部歌单导入**：支持解析网易云音乐、QQ 音乐歌单链接，自动跨平台匹配 B 站对应音视频并导入为本地播放列表。

### 个人媒体库与数据统计
- **本地播放列表**：自由创建和管理本地歌单，支持歌曲批量归类与整理。
- **听歌历史与热力图**：记录个人听歌数据，提供日历热力图直观展示日常听歌频次与历史轨迹。
- **B 站装扮应用**：支持在应用内检索并套用 B 站主题装扮、色彩与背景。

### 音频导出与元数据嵌入
- **带元数据导出**：支持将单曲导出为 `.m4a` 格式音频文件，自动嵌入高清封面图、ID3 标签（歌曲名、艺术家、专辑、BV 号）及内嵌歌词。
- **自定义导出目录**：支持在设置中心指定默认导出文件夹，并在导出弹窗中即时选择与记忆。

### 系统集成与本地优先
- **Windows 系统托盘**：常驻系统任务栏托盘，提供右键原生菜单，支持后台快速切歌、播放控制与桌面歌词显隐。
- **全局快捷键**：支持自定义全局系统快捷键（切歌、播放/暂停、音量增减），前台运行其他软件或游戏时不影响控制。
- **本地优先架构**：采用本地 SQLite 数据库存储播放列表、配置与历史记录，无第三方遥测与数据收集。

---

## 技术栈与架构

- **桌面运行时**：[Tauri v2](https://v2.tauri.app/)（基于 Rust 驱动的跨平台桌面框架）
- **前端视图**：React 18 + TypeScript + Vite + TailwindCSS
- **图标库**：Lucide Icons
- **本地数据库**：SQLite（通过 `@tauri-apps/plugin-sql` 驱动）
- **状态管理**：Zustand
- **原生能力扩展**：Rust（文件对话框 `rfd`、音频导出封装、全局快捷键、原生系统托盘）

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

## 隐私与数据安全

Bili Player 遵循本地优先原则设计：
- **无第三方数据收集**：未集成任何第三方统计、遥测或崩溃分析平台。
- **本地私密存储**：账号登录凭证（Cookies）、收藏夹数据、播放记录及设置配置均存储于本地 SQLite 数据库与用户本地设备中。
- **直接点对点交互**：所有网络交互均仅在客户端与目标服务器之间点对点通信，无任何第三方服务器中转。

---

## 感谢

本项目的设计与实现离不开开源社区，感谢：
- [BBPlayer](https://github.com/bbplayer-app/BBPlayer)
- [Bilibili](https://www.bilibili.com/)

---

## 开源许可证

本项目基于 [MIT License](LICENSE) 许可开源。
