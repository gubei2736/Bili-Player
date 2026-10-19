<div align="center">

<img src="apps/desktop/public/icon.png" alt="Bili Player Logo" width="80" />

# Bili Player

一款基于 **Tauri v2 + React 18 + Rust** 构建的轻量级本地优先 Bilibili PC 桌面音乐播放器。  
提供简洁、优雅、无广告干扰的桌面听歌与高保真音频管理环境。

<p>
  <a href="https://github.com/gubei2736">
    <img src="https://github.com/gubei2736.png" width="48" height="48" alt="gubei2736" style="border-radius: 50%;" />
  </a>
  <br />
  <sub><b>Author & Maintainer: <a href="https://github.com/gubei2736">gubei2736</a></b></sub>
</p>

[![Release](https://img.shields.io/badge/Release-v1.1.2-blue?style=flat-square)](https://github.com/gubei2736/Bili-Player/releases)
[![Maintainer](https://img.shields.io/badge/Maintainer-gubei2736-EA4AAA?style=flat-square&logo=github&logoColor=white)](https://github.com/gubei2736)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/gubei2736/Bili-Player)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---
## 应用截图
<details>
<summary>点击展开大图</summary>

<img width="1565" height="1004" alt="1" src="https://github.com/user-attachments/assets/ec37ec6c-8427-46cd-82cf-82ae9491912f" />
<img width="1564" height="996" alt="2" src="https://github.com/user-attachments/assets/a64775de-e371-450d-bac8-6ede1dca5c62" />
<img width="1564" height="999" alt="4" src="https://github.com/user-attachments/assets/5752ab68-c0e4-4444-b487-61480cabc447" />
<img width="1561" height="999" alt="3" src="https://github.com/user-attachments/assets/52246cb0-1be1-4d78-9d8c-0da4272321ac" />
<img width="1561" height="998" alt="5" src="https://github.com/user-attachments/assets/ae8fa648-6c3d-455a-96fe-a6e5d1502e48" />
<img width="1563" height="1000" alt="6" src="https://github.com/user-attachments/assets/b93a266a-356a-48ac-ad31-f63355615030" />

</details>

## 功能特性

### 音频播放与音质管理
- **账号同步**：支持二维码扫码登录，自动同步账号内的个人收藏夹、合集与订阅列表。
- **音质档位选择**：支持切换高音质、无损及 B 站原声规格音轨（Hi-Res、杜比全景声、标准 AAC）。
- **音频响度平衡优化**：支持基于 EBU R128 标准重构音频增益；默认关闭以完整保留录音室母带原本的动态与听感，可在偏好设置中自由按需开启。
- **一键原网页直达**：播放控制栏直接配备“在浏览器打开原网页”快捷按钮，并支持精准带分 P（Part）参数直达目标视频。
- **60FPS 平滑进度条**：底栏直线进度条与动画循环均锁频至 60FPS，搭载 Pointer Events 指针捕获体系与悬停时间胶囊，拖拽丝滑且杜绝高刷屏（180Hz/240Hz）过载重绘。
- **多分 P 选集解析**：完整支持多 Part 视频解析，提供分集列表弹窗，支持单独点播或整组加入队列。
- **智能缓存锁死与 LRU 淘汰**：网络磁盘缓存严格限制在 100MB 以内、流媒体音频缓存限制在 50MB 以内，超额自动 LRU 淘汰清理，杜绝存储膨胀。
- **断点续播**：自动记忆上次播放进度与曲目状态。

### 歌词系统
- **动态逐字歌词**：支持 SPL 格式逐字精准音节染色渲染及常规 LRC 滚动歌词。
- **双语与注音对照**：完整支持歌词翻译与日韩语罗马音注音对照展示。
- **歌词高亮颜色全端自定义**：在微调弹窗或偏好设置中自由选取歌词字体高亮颜色（提供 8 种高对比经典预设色块与拾色器），全屏沉浸歌词与桌面歌词（含正文、翻译与罗马音）即时同步呈现。
- **桌面歌词通透轻阴影**：彻底消除桌面歌词外圈浓重的深黑高斯模糊光晕，采用清爽细腻的边缘阴影，在浅色、深色或复杂壁纸下均清晰通透不糊黑。
- **独立桌面悬浮歌词**：提供独立的无边框桌面歌词窗口，支持鼠标事件穿透锁定（Ctrl+Alt+L）、双击/右键解锁、字号微调与全屏避让。
- **沉浸式全屏歌词页**：支持进入大屏全屏歌词模式，支持 **F11 一键让应用窗口真全屏**（隐藏任务栏完全占满屏幕，按 Esc 自动退出恢复）。
- **多源匹配与时间轴微调**：内置 QQ 音乐与网易云双音源智能搜索与候选切换，支持手动以 ±0.1s / ±0.5s 步进微调时间轴偏移量。

### 个人媒体库与歌单深度管理
- **本地专属歌单**：支持纯本地自建独立歌单，支持编辑歌单信息（自定义标题、简介与封面图实时预览）。
- **歌曲自由拖拽排序**：歌单列表支持原生拖拽排序，按住曲目抓手即可上下自由拖动排列并即时持久化。
- **音频源手动搜索替换**：歌单曲目支持一键发起 B 站搜索并替换音频源，外部导入未匹配或版本不理想时可快速自选手选版本。
- **听歌历史与热力图**：记录个人听歌数据，提供日历热力图直观展示日常听歌频次与历史轨迹。
- **外部歌单导入**：支持解析网易云音乐、QQ 音乐歌单链接，按严格的分区黑名单与时长误差比对自动跨平台匹配 B 站对应音视频。

### 视觉主题与响应式自适应
- **自适应窗口变化**：偏好设置中心与个性装扮中心全面重构为流式响应网格，各级面板根据窗口尺寸智能自适应缩放。
- **极简通透毛玻璃质感**：侧边栏与底栏采用半透明磨砂设计，与暗夜壁纸背景浑然一体。
- **全景背景与 B 站装扮**：支持自定义全景背景壁纸（支持调节不透明度与模糊度）、UI 文字拾色器，并预设经典 B 站装扮主题。

### 迷你播放器 (Mini Player)
- **单实例互斥运行**：主播放器与迷你播放器严格互斥运行，拉起迷你播放器时自动隐藏主界面，通过托盘或迷你窗关闭按钮一键平滑还原主窗口。
- **主界面同源 60FPS 进度条**：搭载与主界面完全相同的 Pointer Events 拖拽捕获、rAF 动画帧毫秒级平滑插值推进与悬停时间胶囊，丝滑无卡顿。
- **纯净音量键设计**：单个音量键专职静音与取消静音切换，无冗余拖拽滑块，杜绝误触。
- **内置列表抽屉**：支持在小窗内即时展开播放队列，歌曲列表平滑自适应滚动，底部圆角利落裁剪，无多余外部黑色阴影。

### 音频导出与元数据嵌入
- **带元数据导出**：支持将单曲导出为 `.m4a` 格式音频文件，自动嵌入高清封面图、ID3 标签（歌曲名、艺术家、专辑、BV 号）及内嵌歌词。
- **自定义导出目录**：支持在设置中心指定默认导出文件夹，并在导出弹窗中即时选择与记忆。

### 系统集成与本地优先
- **Windows 系统托盘**：常驻系统任务栏托盘，提供右键原生菜单，支持后台快速切歌、播放控制与桌面歌词显隐。
- **全局快捷键**：支持自定义全局系统快捷键（切歌、播放/暂停、音量增减、桌面歌词锁定与显隐），前台运行其他软件或游戏时不影响控制。
- **本地优先架构**：采用本地 SQLite 数据库存储播放列表、配置与历史记录，无第三方遥测与数据收集。

---

## 技术栈与架构

- **桌面运行时**：[Tauri v2](https://v2.tauri.app/)（基于 Rust 驱动的跨平台桌面框架）
- **前端视图**：React 18 + TypeScript + Vite + TailwindCSS
- **图标库**：Lucide Icons
- **本地数据库**：SQLite（通过 `@tauri-apps/plugin-sql` 驱动）
- **状态管理**：Zustand
- **原生能力扩展**：Rust（文件对话框 `rfd`、音频导出封装、全局快捷键、原生系统托盘、系统默认浏览器直达）

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
- 安装版：`apps/desktop/src-tauri/target/release/Bili Player-Setup-1.1.2.exe`
- 便携版：`apps/desktop/src-tauri/target/release/Bili Player-Portable-1.1.2.exe`
- 绿色压缩包：`apps/desktop/src-tauri/target/release/Bili Player-Setup-1.1.2-win.zip`

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
