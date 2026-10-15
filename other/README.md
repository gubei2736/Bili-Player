# Bili Player - 视频分 P 架构与结构逻辑全景归档 (For AI Analysis)

本目录（`G:\Project\Gemini\BBPlayer\other\`）专门用于归档与沉淀 **Bili Player 音乐播放器中关于 Bilibili “视频分 P (Multi-page / Video Parts)” 的完整业务架构、数据结构、核心源码与流转逻辑**，供其他 AI 或开发者进行深度分析、审查与二次重构参考。

---

## 📂 目录结构一览

```text
G:\Project\Gemini\BBPlayer\other\
├── README.md                              # 本导读文档
├── ARCHITECTURE_MULTIPART.md              # 🌟 核心全景架构文档 (含 Mermaid 流程图/时序图/逻辑拆解)
└── src\                                   # 分 P 核心源码与关键切片归档
    ├── types\
    │   └── media.ts                       # 分 P 核心数据类型 (BilibiliTrack, BilibiliVideoPart, BaseTrack)
    ├── components\
    │   ├── VideoPartsModal.tsx            # 分 P 选集交互弹窗组件 (选集展示/高亮/就地替换切歌/批量播放)
    │   ├── BottomPlayerBar_multipart.tsx  # 底栏播放条中分 P 标题格式化与选集唤起切片
    │   └── ImmersiveLyricsView_multipart.tsx # 全屏歌词界面中分 P 标题与主副标题渲染切片
    ├── audio\
    │   └── playTrackHelper.ts             # 核心播放调度器 (分 P 识别/Track 动态元数据重写/流拉取)
    ├── api\
    │   └── bilibili_pagelist_api.ts       # B 站分 P 列表接口 (/x/player/pagelist) 与流接口调用逻辑
    ├── db\
    │   └── schema_bilibili_metadata.ts    # 本地 SQLite 数据库分 P 元数据持久化表定义
    └── docs\
        └── TECHNICAL_DEBT_MULTIPART.md    # 历史技术债备忘与 B 站 API 限制分析
```

---

## 🎯 推荐阅读与分析顺序（针对 AI）

1. **第一步：先读架构全景**
   - 阅读 [`ARCHITECTURE_MULTIPART.md`](./ARCHITECTURE_MULTIPART.md)，理解 B 站视频在音乐播放场景下的本质特征：**一个 `bvid` 包含多个独立的 `cid` 音频流**。
2. **第二步：核对数据结构定义**
   - 查看 [`src/types/media.ts`](./src/types/media.ts)，重点理解 `BilibiliTrack` 与 `BilibiliVideoPart`，以及 `uniqueKey` 的构成机制。
3. **第三步：分析切歌与分 P 识别生命周期**
   - 查看 [`src/audio/playTrackHelper.ts`](./src/audio/playTrackHelper.ts)，理解“整视频懒加载识别分 P”与“切歌时动态更新标题、时长与 uniqueKey”的底层逻辑。
4. **第四步：分析选集交互与播放队列管理**
   - 查看 [`src/components/VideoPartsModal.tsx`](./src/components/VideoPartsModal.tsx)，关注“单 P 就地替换（In-place Replacement）”与“批量展开为独立 Track”的双重机制。
5. **第五步：UI 渲染与状态联动同步**
   - 查看 [`src/components/BottomPlayerBar_multipart.tsx`](./src/components/BottomPlayerBar_multipart.tsx) 与 [`src/components/ImmersiveLyricsView_multipart.tsx`](./src/components/ImmersiveLyricsView_multipart.tsx)。
