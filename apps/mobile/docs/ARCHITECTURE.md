# 项目架构指南

Bili Player 是一个基于 **React Native (Expo)** 的现代化移动端应用。本文档详细介绍了项目的整体架构、目录结构以及核心开发模式。

## 🛠 技术栈概览

- **核心框架**: [Expo](https://expo.dev), [React Native](https://reactnative.dev)
- **路由导航**: [Expo Router](https://docs.expo.dev/router/introduction/) (文件系统路由)
- **状态管理**:
  - [Zustand](https://github.com/pmndrs/zustand) (全局客户端状态)
  - [TanStack Query](https://tanstack.com/query/latest) (服务端/异步状态管理)
- **数据库**: [Drizzle ORM](https://orm.drizzle.team/) + `expo-sqlite`
- **UI 组件**: [React Native Paper](https://reactnativepaper.com/) + 自定义组件
- **错误处理**: [neverthrow](https://github.com/supermacro/neverthrow) (函数式错误处理)

## 🏗 目录结构

```
src/
├── app/                 # Expo Router 路由定义 (Pages)
├── components/          # 通用 UI 组件
├── features/            # 功能模块 (按业务领域划分)
│   ├── player/
│   ├── playlist/
│   └── ...
├── hooks/               # 全局通用 Hooks
├── lib/                 # 核心逻辑与基础设施
│   ├── api/             # 外部 API 集成 (如 Bilibili)
│   ├── config/          # 应用配置
│   ├── db/              # Drizzle 数据库 Schema 与配置
│   ├── facades/         # [架构核心] Facade 层
│   └── services/        # [架构核心] Service 层
├── types/               # TypeScript 类型定义
└── utils/               # 工具函数

注：以上是 `apps/mobile` 内的源码结构。在 Monorepo 根目录下，我们还有 `packages/` 目录用于存放共享包，例如：
- `@bbplayer/orpheus`: 播放器核心逻辑
- `@bbplayer/image-theme-colors`: 图片主题色提取
- `@bbplayer/logs`: 日志工具库
```

## 🧩 核心架构模式

本项目采用了 **分层架构 (Layered Architecture)** 与 **功能切片 (Feature Slices)** 相结合的模式。

### 1. 分层架构 (Layered Architecture)

为了分离关注点，我们将业务逻辑分为以下几层：

#### **UI Layer (Components & Hooks)**

- **位置**: `src/app`, `src/features/*/components`, `src/features/*/hooks`
- **职责**: 处理视图展示、用户交互。
- **原则**: 尽量少包含复杂业务逻辑，主要通过调用 Hooks 或 Facades 来获取数据和执行操作。

#### **Facade Layer (外观模式)**

- **位置**: `src/lib/facades`
- **职责**:
  - 作为 UI 层与底层逻辑的**统一入口**。
  - **编排**多个 Service 的调用。
  - 管理**数据库事务 (Transactions)**，确保操作的原子性。
- **示例**: `PlaylistFacade` 可能同时调用 `PlaylistService` (创建歌单) 和 `TrackService` (添加歌曲)。

#### **Service Layer (领域服务)**

- **位置**: `src/lib/services`
- **职责**:
  - 处理单一领域的**核心业务逻辑**。
  - 直接与数据库 (Drizzle) 交互。
  - 不关心 UI，也不关心事务的开启（通常由 Facade 管理，或者在 Service 内部处理简单查询）。
- **示例**: `PlaylistService` 只负责对 `playlist` 表的增删改查。

#### **Infrastructure / Data Layer**

- **位置**: `src/lib/api`, `src/lib/db`
- **职责**: 处理外部 API 请求和底层数据库连接。

### 2. 错误处理 (Error Handling)

本项目**严禁**在业务逻辑中随意抛出异常 (Throwing Errors)。我们使用 `neverthrow` 库采用 **Result 模式** 进行错误处理。

- **原则**: 函数应返回 `Result<T, E>` 或 `ResultAsync<T, E>`。
- **优势**: 强制调用方处理错误，类型安全，避免隐式崩溃。

## 💾 数据与播放器设计说明

### 播放器数据约束

- **原则**: 传递给 Player 的 Track `uniqueKey` **必须**在本地数据库中有记录。
- **原因**: `currentTrack` hook 依赖 `uniqueKey` 来查询和关联数据库中的扩展元数据。

### 分 P 视频处理 (Bilibili)

目前项目中存在两种视频入口：

1. **整视频** (`isMultiPage = false`)
2. **分 P 视频** (`isMultiPage = true`, 已知 `cid`)

**难点**: 导入时难以标准化为同一键值（获取 `cid` 成本高），可能导致数据库中存在逻辑上重复的记录。目前的策略是尽量保持现状，后续在 `TECHNICAL_DEBT.md` 中有详细记录。
