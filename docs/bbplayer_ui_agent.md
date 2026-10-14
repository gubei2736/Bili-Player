# BBPlayer 桌面端 UI 视觉重塑与 Agent 执行手册

> **致 AI Agent 的执行指令（Agent Execution Instructions）**：
> 本手册旨在将 BBPlayer 桌面端的视觉体验从“基础功能面板”升级为媲美 **Apple Music / Spotify Desktop / Linear** 的高阶流媒体音乐客户端。
> 请按顺序遍历下方「二、核心视觉组件全量重构代码」中的 6 个核心文件，根据标注的 **目标文件路径**，使用代码块中的完整源码直接覆盖对应文件。

---

## 一、 现有 UI 视觉痛点诊断与升级策略

| 维度 | 目前为什么显得“丑 / 廉价”？ | 高阶 UI 美化升级策略 |
| :--- | :--- | :--- |
| **1. 空间光影与层次感** | 全站大量堆砌均质的 `bg-white/5 border-white/5`，缺乏顶光高光（Top Specular Highlight）与环境氛围光，页面显得扁平、发灰且死板。 | **流光玻璃拟态（Specular Glassmorphism）**：<br>1. 主视口注入**动态专辑封面氛围背光**，随当前播放歌曲自动晕染环境色彩；<br>2. 卡片采用 `border-t-white/15 border-white/[0.06]` 模拟真实物理顶光反射，搭配柔和内阴影 `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]`。 |
| **2. 导航栏与标题栏** | 左侧边栏按钮像普通后台管理系统，缺乏激活指示条；顶部搜索框宽度呆板，无快捷键徽章提示；用户卡片过于简陋。 | **胶囊流光导航 + 灵动顶栏**：<br>1. 侧边栏选中项增加左侧发光胶囊指示器（Glowing Pill）与微妙渐变底色；<br>2. 搜索框加入聚焦加宽过渡与 `<kbd>⌘K</kbd>` 视觉装饰；<br>3. 底部个人中心升级为带在线呼吸灯的悬浮玻璃吊舱。 |
| **3. 发现页 Hero 与卡片** | Hero 横幅只是简单的三色透明渐变框；音乐卡片播放按钮生硬居中弹出，图片四周缺乏暗角与层次过渡。 | **沉浸式画报 Hero + 悬浮微动效卡片**：<br>1. Hero 区域引入双层光斑（Mesh Gradient Orbs）、高光徽章与快捷“一键畅听”主按钮；<br>2. 歌曲卡片采用类似 Spotify 的**右下角上浮翠绿/主题色光晕播放按钮**（带 `translate-y-2 group-hover:translate-y-0` 阻尼上浮），封面增加底部暗角渐变。 |
| **4. 底部播放控制栏** | 原生 `<input type="range">` 音量条样式粗糙；当未播放歌曲时用了一个突兀的 `🎵` Emoji 占位；主播放按钮缺乏光晕呼吸感。 | **定制进度滑块 + 悬浮黑胶/光晕主控**：<br>1. 移除 Emoji 占位，改为精致的拉丝黑胶唱片图标容器；<br>2. 音量条重构为自定义百分比填充轨道，悬停时平滑浮现圆形拖拽滑块；<br>3. 播放主按钮增加主题色弥散投影与按压弹性缩放。 |
| **5. 波浪进度条 (`WavySlider`)** | 波浪线条颜色单一，未播放轨道与已播放轨道交界处缺少渐变过渡，悬停时看不到对应位置的时间预览。 | **流光渐变波浪 + 悬停时间气泡**：<br>1. 为 Canvas 波浪线添加水平高亮渐变与柔和发光滤镜；<br>2. 鼠标悬停在进度条上时，实时跟随鼠标展示**胶囊时间预览气泡（Hover Time Tooltip）**。 |
| **6. 全屏歌词 (`ImmersiveLyricsView`)** | 左右分栏比例普通，专辑封面呆板正方形展示；非高亮歌词字重与间距缺乏呼吸感。 | **黑胶唱盘光环 + 大师级排版律动**：<br>1. 封面外圈嵌套微弱旋转的仿真黑胶纹理环与多层音频律动呼吸光环；<br>2. 歌词采用大字号（`text-2xl md:text-4xl`）非线性弹簧缩放与渐进高斯模糊，提升逐字卡拉OK染色的对比度与辉光。 |

---

## 二、 核心视觉组件全量重构代码（共 6 个文件）

---

### 文件 1：`apps/desktop/src/styles/globals.css`
* **美化说明**：
  1. 新增 `.glass-panel`、`.glass-card`、`.specular-border` 等高阶玻璃质感工具类，利用顶部 `1px` 高光内阴影营造精致立体感。
  2. 新增 `.bg-radial-vignette` 径向暗角与 `.no-scrollbar` 隐藏滚动条样式，消除全屏歌词及横向列表的割裂感。
  3. 美化自定义 `<input type="range">` 轨道与滑块外观。

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
	:root {
		--background: 222 32% 6%;
		--foreground: 210 25% 98%;
		--card: 222 28% 9%;
		--card-foreground: 210 25% 98%;
		--popover: 222 30% 8%;
		--popover-foreground: 210 25% 98%;
		--primary-rgb: 0 174 236;
		--primary: #00AEEC;
		--primary-foreground: 0 0% 100%;
		--secondary: 218 22% 14%;
		--secondary-foreground: 210 20% 98%;
		--muted: 218 22% 13%;
		--muted-foreground: 215 16% 62%;
		--accent: 218 25% 16%;
		--accent-foreground: 210 20% 98%;
		--destructive: 0 72% 55%;
		--destructive-foreground: 210 20% 98%;
		--border: 217 20% 16%;
		--input: 217 20% 16%;
		--ring: 197 100% 46%;
		--radius: 0.85rem;

		/* B站装扮动态主色 */
		--bili-theme-primary: #00AEEC;
		--bili-theme-secondary: #FB7299;
	}

	.dark {
		--background: 222 32% 6%;
		--foreground: 210 25% 98%;
		--card: 222 28% 9%;
		--card-foreground: 210 25% 98%;
		--popover: 222 30% 8%;
		--popover-foreground: 210 25% 98%;
		--primary-rgb: 0 174 236;
		--primary: #00AEEC;
		--primary-foreground: 0 0% 100%;
		--secondary: 218 22% 14%;
		--secondary-foreground: 210 20% 98%;
		--muted: 218 22% 13%;
		--muted-foreground: 215 16% 62%;
		--accent: 218 25% 16%;
		--accent-foreground: 210 20% 98%;
		--destructive: 0 62% 35%;
		--destructive-foreground: 210 20% 98%;
		--border: 217 20% 16%;
		--input: 217 20% 16%;
		--ring: 197 100% 46%;
	}
}

body {
	color: hsl(var(--foreground));
	background-color: transparent;
	font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
		'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	user-select: none;
	-webkit-user-select: none;
	overflow: hidden;
}

/* 高阶流光毛玻璃表面 (带顶部 1px 镜面高光反射) */
.mica-surface {
	background-color: rgba(11, 14, 22, 0.78);
	backdrop-filter: blur(28px) saturate(180%);
	-webkit-backdrop-filter: blur(28px) saturate(180%);
	box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.08);
}

.acrylic-card {
	background: linear-gradient(
		145deg,
		rgba(255, 255, 255, 0.055) 0%,
		rgba(255, 255, 255, 0.018) 100%
	);
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border: 1px solid rgba(255, 255, 255, 0.07);
	box-shadow:
		0 8px 24px -4px rgba(0, 0, 0, 0.35),
		inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
	transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.acrylic-card:hover {
	background: linear-gradient(
		145deg,
		rgba(255, 255, 255, 0.09) 0%,
		rgba(255, 255, 255, 0.03) 100%
	);
	border-color: rgba(255, 255, 255, 0.16);
	box-shadow:
		0 14px 32px -6px rgba(0, 0, 0, 0.5),
		inset 0 1px 0 0 rgba(255, 255, 255, 0.18);
}

/* 全屏歌词径向暗角遮罩 */
.bg-radial-vignette {
	background: radial-gradient(
		circle at center,
		transparent 20%,
		rgba(6, 8, 14, 0.65) 80%,
		rgba(6, 8, 14, 0.92) 100%
	);
}

/* 隐藏滚动条工具类 */
.no-scrollbar::-webkit-scrollbar,
.scrollbar-none::-webkit-scrollbar {
	display: none;
}
.no-scrollbar,
.scrollbar-none {
	-ms-overflow-style: none;
	scrollbar-width: none;
}

/* 全局隐藏默认丑陋滚动条，仅在主视口保留极细微光滚动条 */
::-webkit-scrollbar {
	width: 5px;
	height: 5px;
}
::-webkit-scrollbar-track {
	background: transparent;
}
::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.1);
	border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.25);
}
```

---

### 文件 2：`apps/desktop/src/components/layout/MainLayout.tsx`
* **美化说明**：
  1. 引入**动态封面色彩晕染背景（Dynamic Cover Ambient Backdrop）**：读取当前正在播放歌曲的封面图，在应用底层进行超大半径模糊（`blur-[110px]`）与低透明度叠加，使整个客户端的氛围光随当前播放的音乐封面实时呼吸变幻。
  2. 为右侧主内容视口添加圆润内嵌边框与顶部高光分割，形成类似 macOS Sonoma / Linear 的精致分栏结构。

```tsx
import React, { useState } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar, type NavTab } from './Sidebar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { useQueueStore } from '@bbplayer/shared-core'

export interface MainLayoutProps {
	children: (activeTab: NavTab) => React.ReactNode
	activeTab?: NavTab
	onSelectTab?: (tab: NavTab) => void
	onSearch?: (query: string) => void
	onToggleLyricsWindow?: () => void
	onToggleFullscreenLyrics?: () => void
	onOpenLoginModal?: () => void
}

export const MainLayout: React.FC<MainLayoutProps> = ({
	children,
	activeTab: externalActiveTab,
	onSelectTab,
	onSearch,
	onToggleLyricsWindow,
	onToggleFullscreenLyrics,
	onOpenLoginModal,
}) => {
	const [internalActiveTab, setInternalActiveTab] = useState<NavTab>('explore')
	const activeTab =
		externalActiveTab !== undefined ? externalActiveTab : internalActiveTab
	const setActiveTab = onSelectTab || setInternalActiveTab

	const currentTrack = useQueueStore((s) => s.getCurrentTrack())

	return (
		<div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07090e] text-foreground border border-white/10 shadow-2xl relative select-none">
			{/* 1. Ambient Dynamic Cover Glow (随当前播放歌曲封面实时晕染底层环境光) */}
			<div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
				{currentTrack?.coverUrl && (
					<img
						src={currentTrack.coverUrl}
						alt=""
						referrerPolicy="no-referrer"
						className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] object-cover blur-[120px] opacity-[0.16] saturate-200 scale-125 transition-all duration-1000"
					/>
				)}
				{/* 顶部主题色微光 */}
				<div className="absolute -top-32 left-1/3 w-[600px] h-[320px] rounded-full bg-primary/20 blur-[110px] opacity-60 transition-colors duration-700" />
				<div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
			</div>

			{/* 2. Top frameless title bar */}
			<TitleBar
				onSearch={onSearch}
				onToggleLyricsWindow={onToggleLyricsWindow}
			/>

			{/* 3. Middle area: Sidebar + Inset Glass Main Viewport */}
			<div className="flex flex-1 overflow-hidden relative z-10 px-2 pb-1.5 gap-2">
				<Sidebar
					activeTab={activeTab}
					onSelectTab={setActiveTab}
					onOpenLoginModal={onOpenLoginModal}
				/>
				<main className="flex-1 h-full overflow-y-auto relative rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] px-7 py-6 backdrop-blur-xl">
					{children(activeTab)}
				</main>
			</div>

			{/* 4. Bottom audio controller bar */}
			<BottomPlayerBar onToggleFullscreenLyrics={onToggleFullscreenLyrics} />
		</div>
	)
}
```

---

### 文件 3：`apps/desktop/src/components/layout/TitleBar.tsx`
* **美化说明**：
  1. 品牌 Logo 增加多层流光边框与高光质感徽章。
  2. 搜索框支持聚焦时平滑加宽（`focus-within:max-w-lg`）、内置一键清空按钮（`X`）以及精致的 `<kbd>Enter</kbd>` 视觉提示。
  3. 桌面歌词开关与置顶按钮采用胶囊微光交互态，修正快捷键提示为 `Ctrl+Alt+D`。

```tsx
import React, { useState } from 'react'
import {
	Minus,
	Square,
	X,
	Search,
	Pin,
	Sparkles,
	Disc3,
} from 'lucide-react'

export interface TitleBarProps {
	onSearch?: (query: string) => void
	onToggleLyricsWindow?: () => void
}

export const TitleBar: React.FC<TitleBarProps> = ({
	onSearch,
	onToggleLyricsWindow,
}) => {
	const [query, setQuery] = useState('')
	const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
	const [isMaximized, setIsMaximized] = useState(false)

	const handleMinimize = async () => {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window')
			await getCurrentWindow().minimize()
		} catch {}
	}

	const handleMaximize = async () => {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window')
			const win = getCurrentWindow()
			await win.toggleMaximize()
			setIsMaximized(await win.isMaximized())
		} catch {
			setIsMaximized(!isMaximized)
		}
	}

	const handleClose = async () => {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window')
			await getCurrentWindow().close()
		} catch {}
	}

	const handleTogglePin = async () => {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window')
			const nextState = !isAlwaysOnTop
			await getCurrentWindow().setAlwaysOnTop(nextState)
			setIsAlwaysOnTop(nextState)
		} catch {
			setIsAlwaysOnTop(!isAlwaysOnTop)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && onSearch && query.trim()) {
			onSearch(query.trim())
		}
	}

	return (
		<header
			data-tauri-drag-region
			className="h-12 w-full flex items-center justify-between px-4 select-none bg-transparent z-50 text-xs"
		>
			{/* Left branding */}
			<div className="flex items-center gap-2.5 pointer-events-none min-w-[190px]">
				<div className="relative w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 via-primary to-sky-400 p-[1px] shadow-md shadow-primary/20">
					<div className="w-full h-full bg-[#090d16] rounded-[7px] flex items-center justify-center">
						<Disc3 className="w-3.5 h-3.5 text-primary animate-[spin_12s_linear_infinite]" />
					</div>
				</div>
				<span className="font-bold tracking-tight text-foreground text-[13px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
					BBPlayer
				</span>
				<span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25 font-mono font-medium">
					PRO
				</span>
			</div>

			{/* Center search pill */}
			<div className="flex-1 max-w-sm focus-within:max-w-md transition-all duration-300 mx-4 pointer-events-auto">
				<div className="relative flex items-center group">
					<Search className="w-3.5 h-3.5 absolute left-3.5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="搜索 B 站音乐、歌手、BV号..."
						className="w-full h-8 pl-9 pr-14 text-xs rounded-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-[#0d121f]/90 border border-white/[0.08] focus:border-primary/50 text-foreground placeholder:text-muted-foreground/70 outline-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] focus:ring-2 focus:ring-primary/15 transition-all duration-200"
					/>
					{query ? (
						<button
							onClick={() => setQuery('')}
							className="absolute right-2.5 p-0.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						>
							<X className="w-3 h-3" />
						</button>
					) : (
						<kbd className="absolute right-3 pointer-events-none hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-muted-foreground/70 border border-white/[0.06]">
							↵
						</kbd>
					)}
				</div>
			</div>

			{/* Right actions & Window controls */}
			<div className="flex items-center justify-end gap-1 min-w-[190px]">
				{onToggleLyricsWindow && (
					<button
						onClick={onToggleLyricsWindow}
						title="切换桌面悬浮歌词 (Ctrl+Alt+D)"
						className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-primary/15 border border-white/[0.06] hover:border-primary/30 text-muted-foreground hover:text-primary transition-all duration-150 mr-1"
					>
						<Sparkles className="w-3 h-3" />
						<span className="text-[11px] font-medium">词</span>
					</button>
				)}

				<button
					onClick={handleTogglePin}
					title={isAlwaysOnTop ? '取消窗口置顶' : '置顶窗口'}
					className={`p-1.5 rounded-lg transition-colors ${
						isAlwaysOnTop
							? 'bg-primary/20 text-primary border border-primary/30'
							: 'hover:bg-white/10 text-muted-foreground hover:text-foreground'
					}`}
				>
					<Pin className="w-3.5 h-3.5" />
				</button>

				<div className="h-3.5 w-px bg-white/10 mx-1.5" />

				<button
					onClick={handleMinimize}
					title="最小化"
					className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
				>
					<Minus className="w-3.5 h-3.5" />
				</button>

				<button
					onClick={handleMaximize}
					title={isMaximized ? '还原' : '最大化'}
					className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
				>
					<Square className="w-3 h-3" />
				</button>

				<button
					onClick={handleClose}
					title="关闭窗口"
					className="p-1.5 rounded-lg hover:bg-rose-500 hover:text-white text-muted-foreground transition-colors"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>
		</header>
	)
}
```

---

### 文件 4：`apps/desktop/src/components/layout/Sidebar.tsx`
* **美化说明**：
  1. 将导航菜单按语义拆分为 **“在线音乐馆”** 与 **“我的私享与定制”** 两大分组，增强视觉呼吸感。
  2. 为激活态菜单项引入**左侧发光胶囊指示条（Glowing Pill Indicator）**与渐变高光底色。
  3. 底部用户信息卡升级为悬浮毛玻璃舱，增加在线状态绿点与头像光晕环。

```tsx
import React from 'react'
import {
	Compass,
	Library,
	Heart,
	FolderHeart,
	History,
	Palette,
	Settings,
	LogIn,
	LogOut,
	Sparkles,
} from 'lucide-react'
import { useAuthStore } from '@bbplayer/shared-core'

export type NavTab =
	| 'explore'
	| 'search'
	| 'library'
	| 'favorites'
	| 'collections'
	| 'history'
	| 'skins'
	| 'settings'

export interface SidebarProps {
	activeTab: NavTab
	onSelectTab: (tab: NavTab) => void
	onOpenLoginModal?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
	activeTab,
	onSelectTab,
	onOpenLoginModal,
}) => {
	const { isLoggedIn, userInfo, logout } = useAuthStore()

	const discoverGroup: { id: NavTab; label: string; icon: React.ReactNode }[] = [
		{ id: 'explore', label: '发现音乐', icon: <Compass className="w-4 h-4" /> },
		{ id: 'library', label: '我的音乐库', icon: <Library className="w-4 h-4" /> },
	]

	const myMusicGroup: { id: NavTab; label: string; icon: React.ReactNode }[] = [
		{ id: 'favorites', label: '我喜欢的音乐', icon: <Heart className="w-4 h-4" /> },
		{ id: 'collections', label: '追更合集', icon: <FolderHeart className="w-4 h-4" /> },
		{ id: 'history', label: '收听足迹', icon: <History className="w-4 h-4" /> },
	]

	const systemGroup: { id: NavTab; label: string; icon: React.ReactNode }[] = [
		{ id: 'skins', label: '个性装扮', icon: <Palette className="w-4 h-4" /> },
		{ id: 'settings', label: '偏好设置', icon: <Settings className="w-4 h-4" /> },
	]

	const renderNavButton = (item: {
		id: NavTab
		label: string
		icon: React.ReactNode
	}) => {
		const isActive = activeTab === item.id
		return (
			<button
				key={item.id}
				onClick={() => onSelectTab(item.id)}
				className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 text-xs rounded-xl transition-all duration-200 ${
					isActive
						? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/25'
						: 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent'
				}`}
			>
				{/* 左侧流光胶囊指示条 */}
				{isActive && (
					<span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.9)]" />
				)}
				<span
					className={`transition-transform duration-200 ${
						isActive
							? 'text-primary scale-105'
							: 'text-muted-foreground group-hover:text-foreground group-hover:scale-105'
					}`}
				>
					{item.icon}
				</span>
				<span className="truncate">{item.label}</span>
			</button>
		)
	}

	return (
		<aside className="w-56 h-full flex flex-col justify-between rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl select-none p-3">
			{/* Top Nav Groups */}
			<div className="space-y-5 overflow-y-auto no-scrollbar pt-1">
				<div className="space-y-1">
					<p className="px-3 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
						音乐馆
					</p>
					{discoverGroup.map(renderNavButton)}
				</div>

				<div className="space-y-1">
					<p className="px-3 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
						我的私享
					</p>
					{myMusicGroup.map(renderNavButton)}
				</div>

				<div className="space-y-1">
					<p className="px-3 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
						个性化与系统
					</p>
					{systemGroup.map(renderNavButton)}
				</div>
			</div>

			{/* Bottom User Profile / Login Pod */}
			<div className="pt-3 border-t border-white/[0.06]">
				{isLoggedIn && userInfo ? (
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] shadow-inner">
						<div className="flex items-center gap-2.5 overflow-hidden">
							<div className="relative flex-shrink-0">
								<img
									src={userInfo.face}
									alt={userInfo.name}
									referrerPolicy="no-referrer"
									className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/40"
								/>
								<span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0b0f17]" />
							</div>
							<div className="overflow-hidden">
								<p className="text-xs font-bold truncate text-foreground">
									{userInfo.name}
								</p>
								<p className="text-[10px] text-emerald-400/90 font-medium truncate">
									Bilibili 已连接
								</p>
							</div>
						</div>
						<button
							onClick={logout}
							title="退出登录"
							className="p-1.5 rounded-lg hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors flex-shrink-0"
						>
							<LogOut className="w-3.5 h-3.5" />
						</button>
					</div>
				) : (
					<button
						onClick={onOpenLoginModal}
						className="group relative w-full overflow-hidden rounded-xl p-[1px] transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
					>
						<div className="absolute inset-0 bg-gradient-to-r from-primary via-pink-500 to-sky-400 opacity-70 group-hover:opacity-100 transition-opacity" />
						<div className="relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-[11px] bg-[#0b101b]/90 group-hover:bg-[#0b101b]/75 text-xs font-semibold text-white transition-all">
							<LogIn className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
							<span>扫码连接 B 站账号</span>
							<Sparkles className="w-3 h-3 text-pink-400 opacity-80" />
						</div>
					</button>
				)}
			</div>
		</aside>
	)
}
```

---

### 文件 5：`apps/desktop/src/components/layout/BottomPlayerBar.tsx`
* **美化说明**：
  1. 采用**悬浮玻璃控制台设计**，顶部波浪进度条无缝嵌入，消除生硬断层。
  2. 移除未播放歌曲时的 `🎵` Emoji，改用带微光呼吸环的拉丝黑胶唱片组件（`Disc3`），播放时封面图微动发光。
  3. 定制高颜值**平滑填充音量滑块（Custom Volume Pill Track）**，替代浏览器默认粗糙的 `<input type="range">`。
  4. 包含此前修复的单曲循环归零重播、歌词偏移实时监听与自定义歌词事件广播。

```tsx
import React, { useState, useEffect, useMemo } from 'react'
import {
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Repeat,
	Repeat1,
	Shuffle,
	Volume2,
	VolumeX,
	Maximize2,
	Sliders,
	FileText,
	Disc3,
} from 'lucide-react'
import { useQueueStore, useSkinStore, type BilibiliTrack } from '@bbplayer/shared-core'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import { getQualityBadgeInfo } from '../../audio/audioSettings'
import { WavySlider } from '../player/WavySlider'
import { parseSpl } from '@bbplayer/splash'
import {
	lyricService,
	getStoredLyricOffset,
} from '../../services/lyricService'
import { LyricsSettingsModal } from '../modals/LyricsSettingsModal'

export interface BottomPlayerBarProps {
	onToggleFullscreenLyrics?: () => void
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
	onToggleFullscreenLyrics,
}) => {
	const {
		playMode,
		setPlayMode,
		next,
		prev,
		getCurrentTrack,
	} = useQueueStore()

	const { themeColors } = useSkinStore()

	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [volume, setVolume] = useState(0.8)
	const [isMuted, setIsMuted] = useState(false)
	const [loudnessEnabled, setLoudnessEnabled] = useState(() =>
		desktopAudioEngine.isLoudnessNormalizationEnabled(),
	)

	const currentTrack = getCurrentTrack()
	const biliTrack =
		currentTrack?.source === 'bilibili' ? (currentTrack as BilibiliTrack) : null
	const currentQualityId = biliTrack?.bilibiliMetadata?.bilibiliStreamUrl?.quality
	const badgeInfo = currentTrack ? getQualityBadgeInfo(currentQualityId) : null

	const [splContent, setSplContent] = useState<string>('')
	const [lyricOffsetSec, setLyricOffsetSec] = useState<number>(0)
	const [lyricModalOpen, setLyricModalOpen] = useState(false)

	useEffect(() => {
		let cancelled = false
		if (currentTrack) {
			setLyricOffsetSec(getStoredLyricOffset(currentTrack.uniqueKey))
			lyricService.fetchLyricForTrack(currentTrack).then((res) => {
				if (!cancelled) {
					setSplContent(res?.splContent || '')
				}
			})
		} else {
			setSplContent('')
			setLyricOffsetSec(0)
		}
		return () => {
			cancelled = true
		}
	}, [currentTrack?.uniqueKey])

	useEffect(() => {
		const handleCustomLyric = (e: any) => {
			if (e.detail?.trackKey === currentTrack?.uniqueKey) {
				setSplContent(e.detail.splContent)
			}
		}
		const handleOffsetChange = (e: any) => {
			if (e.detail?.trackKey === currentTrack?.uniqueKey) {
				setLyricOffsetSec(
					e.detail.offsetSec ?? getStoredLyricOffset(currentTrack.uniqueKey),
				)
			}
		}
		window.addEventListener('bbplayer:custom-lyric-change', handleCustomLyric)
		window.addEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		return () => {
			window.removeEventListener('bbplayer:custom-lyric-change', handleCustomLyric)
			window.removeEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		}
	}, [currentTrack?.uniqueKey])

	const splData = useMemo(() => {
		if (!splContent) return null
		try {
			return parseSpl(splContent)
		} catch {
			return null
		}
	}, [splContent])

	const currentLine = useMemo(() => {
		if (!splData || splData.lines.length === 0) return null
		const ms = (currentTime + lyricOffsetSec) * 1000
		for (let i = splData.lines.length - 1; i >= 0; i--) {
			if (ms >= splData.lines[i]!.startTime) {
				return splData.lines[i]!
			}
		}
		return splData.lines[0] || null
	}, [splData, currentTime, lyricOffsetSec])

	useEffect(() => {
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			if (event.type === 'play') setIsPlaying(true)
			if (event.type === 'pause') setIsPlaying(false)
			if (event.type === 'timeupdate') {
				setCurrentTime(event.currentTime)
				setDuration(event.duration || 0)
			}
			if (event.type === 'ended') {
				const prevUniqueKey = desktopAudioEngine.getCurrentTrack()?.uniqueKey
				const nextTrack = next()
				if (!nextTrack) {
					setIsPlaying(false)
				} else if (nextTrack.uniqueKey === prevUniqueKey) {
					desktopAudioEngine.seek(0)
					desktopAudioEngine.play().catch((err) =>
						console.error('Failed to replay track on repeat_one:', err),
					)
				}
			}
		})

		return unsubscribe
	}, [next])

	useEffect(() => {
		desktopAudioEngine.setupMediaSessionHandlers({
			onPlay: () => desktopAudioEngine.play(),
			onPause: () => desktopAudioEngine.pause(),
			onNext: () => next(),
			onPrev: () => prev(),
			onSeek: (time) => desktopAudioEngine.seek(time),
		})
	}, [next, prev])

	useEffect(() => {
		if (
			currentTrack &&
			currentTrack.uniqueKey !== desktopAudioEngine.getCurrentTrack()?.uniqueKey
		) {
			playTrackWithProxy(currentTrack).catch((err) =>
				console.error('Failed to auto play track:', err),
			)
		}
	}, [currentTrack])

	const togglePlayPause = async () => {
		if (isPlaying) {
			desktopAudioEngine.pause()
		} else {
			if (
				currentTrack &&
				currentTrack.uniqueKey !== desktopAudioEngine.getCurrentTrack()?.uniqueKey
			) {
				try {
					await playTrackWithProxy(currentTrack)
				} catch (err) {
					console.error('Failed to play track:', err)
				}
			} else {
				await desktopAudioEngine.play()
			}
		}
	}

	const handleSeek = (fraction: number) => {
		const seekTime = fraction * duration
		desktopAudioEngine.seek(seekTime)
		setCurrentTime(seekTime)
	}

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value)
		setVolume(val)
		setIsMuted(val === 0)
		desktopAudioEngine.setVolume(val)
	}

	const toggleMute = () => {
		if (isMuted) {
			setIsMuted(false)
			desktopAudioEngine.setVolume(volume || 0.5)
		} else {
			setIsMuted(true)
			desktopAudioEngine.setVolume(0)
		}
	}

	const togglePlayMode = () => {
		const modes: ('sequential' | 'shuffle' | 'repeat_all' | 'repeat_one')[] = [
			'sequential',
			'shuffle',
			'repeat_all',
			'repeat_one',
		]
		const nextIdx = (modes.indexOf(playMode) + 1) % modes.length
		setPlayMode(modes[nextIdx]!)
	}

	const toggleLoudnessNormalization = () => {
		const nextState = !loudnessEnabled
		setLoudnessEnabled(nextState)
		desktopAudioEngine.setLoudnessNormalization(nextState)
	}

	const progress = duration > 0 ? currentTime / duration : 0
	const primaryColor = themeColors?.color || '#00AEEC'
	const effectiveVolumePct = (isMuted ? 0 : volume) * 100

	return (
		<footer className="h-[84px] w-full flex flex-col justify-between px-5 pt-1 pb-2.5 select-none bg-[#090d16]/85 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-10px_30px_rgba(0,0,0,0.45)] z-40">
			{/* Top: Wavy Progress Bar */}
			<div className="w-full px-1">
				<WavySlider
					value={progress}
					duration={duration}
					isPlaying={isPlaying}
					onChange={handleSeek}
					primaryColor={primaryColor}
				/>
			</div>

			{/* Bottom: 3-column control bar */}
			<div className="w-full flex items-center justify-between gap-4">
				{/* Left: Track Information */}
				<div className="flex items-center gap-3.5 w-[28%] min-w-[210px]">
					{currentTrack ? (
						<>
							<div
								onClick={onToggleFullscreenLyrics}
								className="relative group cursor-pointer w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/15 shadow-lg shadow-black/50"
							>
								<img
									src={
										currentTrack.coverUrl ||
										'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
									}
									alt={currentTrack.title}
									referrerPolicy="no-referrer"
									className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
								/>
								<div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
									<Maximize2 className="w-4 h-4 text-white drop-shadow" />
								</div>
							</div>
							<div className="overflow-hidden space-y-0.5">
								<p
									onClick={onToggleFullscreenLyrics}
									className="text-xs font-bold truncate hover:text-primary cursor-pointer text-foreground transition-colors"
									title={currentTrack.title}
								>
									{currentTrack.title}
								</p>
								<div className="flex items-center gap-1.5">
									<p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
										{currentTrack.artist?.name || '未知歌手'}
									</p>
									{badgeInfo && (
										<span
											className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold border leading-tight ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.color}`}
											title={`当前音频流质量 ID: ${currentQualityId || '默认'}`}
										>
											{badgeInfo.text}
										</span>
									)}
								</div>
							</div>
						</>
					) : (
						<div className="flex items-center gap-3 text-muted-foreground text-xs">
							<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 flex items-center justify-center shadow-inner">
								<Disc3 className="w-5 h-5 text-muted-foreground/60" />
							</div>
							<div className="space-y-0.5">
								<p className="text-xs font-semibold text-foreground/80">
									等待播放曲目
								</p>
								<p className="text-[10px] text-muted-foreground/60">
									探索或搜索你喜爱的 B 站音乐
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Center: Status Bar Lyrics & Playback Controls */}
				<div className="flex flex-col items-center justify-center flex-1 max-w-lg">
					{/* Status Bar Lyric Pill */}
					<div
						onClick={onToggleFullscreenLyrics}
						className="h-4 flex items-center justify-center gap-2 cursor-pointer text-center overflow-hidden max-w-md group mb-1"
						title="点击展开沉浸式全屏歌词"
					>
						{currentLine ? (
							<div className="flex items-center gap-2 text-xs truncate px-2.5 py-0.5 rounded-full bg-white/[0.03] group-hover:bg-primary/10 transition-colors">
								<span className="font-semibold text-foreground/95 group-hover:text-primary transition-colors truncate">
									{currentLine.content}
								</span>
								{currentLine.translation && (
									<span className="text-[11px] text-muted-foreground/80 hidden sm:inline group-hover:text-sky-300 transition-colors truncate">
										{currentLine.translation}
									</span>
								)}
							</div>
						) : (
							<span className="text-[10px] text-muted-foreground/50 tracking-wider hover:text-muted-foreground transition-colors">
								{currentTrack
									? '♪ 沉浸聆听中 · 点击展开全屏歌词'
									: 'BBPlayer Hi-Fi 桌面音频引擎'}
							</span>
						)}
					</div>

					{/* Playback Controls */}
					<div className="flex items-center gap-5">
						<button
							onClick={togglePlayMode}
							title={`播放模式: ${playMode}`}
							className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						>
							{playMode === 'shuffle' && (
								<Shuffle className="w-3.5 h-3.5 text-primary" />
							)}
							{playMode === 'repeat_one' && (
								<Repeat1 className="w-3.5 h-3.5 text-primary" />
							)}
							{playMode === 'repeat_all' && (
								<Repeat className="w-3.5 h-3.5 text-primary" />
							)}
							{playMode === 'sequential' && <Repeat className="w-3.5 h-3.5" />}
						</button>

						<button
							onClick={prev}
							title="上一曲"
							className="p-1.5 rounded-full hover:bg-white/10 text-foreground/85 hover:text-white transition-all active:scale-90"
						>
							<SkipBack className="w-4 h-4 fill-current" />
						</button>

						<button
							onClick={togglePlayPause}
							title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
							className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-105 active:scale-95"
							style={{
								backgroundColor: primaryColor,
								boxShadow: `0 4px 18px ${primaryColor}66`,
							}}
						>
							{isPlaying ? (
								<Pause className="w-4 h-4 fill-current" />
							) : (
								<Play className="w-4 h-4 fill-current ml-0.5" />
							)}
						</button>

						<button
							onClick={next}
							title="下一曲"
							className="p-1.5 rounded-full hover:bg-white/10 text-foreground/85 hover:text-white transition-all active:scale-90"
						>
							<SkipForward className="w-4 h-4 fill-current" />
						</button>

						<button
							onClick={toggleLoudnessNormalization}
							title={
								loudnessEnabled
									? 'EBU R128 响度均衡：已开启'
									: 'EBU R128 响度均衡：已关闭'
							}
							className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
								loudnessEnabled ? 'text-primary' : 'text-muted-foreground'
							}`}
						>
							<Sliders className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>

				{/* Right: Custom Volume Slider & Lyric Triggers */}
				<div className="flex items-center justify-end gap-2 w-[28%] min-w-[210px]">
					<div className="flex items-center gap-2 group/vol mr-1">
						<button
							onClick={toggleMute}
							className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						>
							{isMuted || volume === 0 ? (
								<VolumeX className="w-4 h-4 text-rose-400" />
							) : (
								<Volume2 className="w-4 h-4" />
							)}
						</button>

						{/* Custom Styled Volume Slider */}
						<div className="relative w-20 h-5 flex items-center">
							<div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
								<div
									className="h-full rounded-full transition-all duration-75"
									style={{
										width: `${effectiveVolumePct}%`,
										backgroundColor: primaryColor,
									}}
								/>
							</div>
							<input
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={isMuted ? 0 : volume}
								onChange={handleVolumeChange}
								className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
							/>
							<div
								className="w-2.5 h-2.5 rounded-full bg-white shadow pointer-events-none opacity-0 group-hover/vol:opacity-100 transition-opacity absolute"
								style={{
									left: `calc(${effectiveVolumePct}% - 5px)`,
								}}
							/>
						</div>
					</div>

					<button
						onClick={() => setLyricModalOpen(true)}
						title="歌词搜索匹配与时间微调"
						className="p-2 rounded-xl bg-white/[0.03] hover:bg-primary/15 border border-white/[0.06] hover:border-primary/30 text-muted-foreground hover:text-primary transition-all"
					>
						<FileText className="w-3.5 h-3.5" />
					</button>

					<button
						onClick={onToggleFullscreenLyrics}
						title="全屏沉浸歌词模式"
						className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/[0.06] text-muted-foreground hover:text-foreground transition-all"
					>
						<Maximize2 className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			<LyricsSettingsModal
				isOpen={lyricModalOpen}
				onClose={() => setLyricModalOpen(false)}
				track={currentTrack}
				onLyricsUpdated={(spl) => {
					setSplContent(spl)
					if (currentTrack) {
						window.dispatchEvent(
							new CustomEvent('bbplayer:custom-lyric-change', {
								detail: { trackKey: currentTrack.uniqueKey, splContent: spl },
							}),
						)
					}
				}}
			/>
		</footer>
	)
}
```

---

### 文件 6：`apps/desktop/src/components/player/WavySlider.tsx`
* **美化说明**：
  1. 波浪已播放区域采用**水平流光渐变 + 发光阴影**，游标（Cursor）在鼠标悬停或拖拽时具有平滑放大动效。
  2. 新增**鼠标悬停时间气泡（Hover Time Tooltip）**：当鼠标在进度条上移动时，实时显示对应位置的 `mm:ss` 时间戳。

```tsx
import React, { useRef, useEffect, useState, useCallback } from 'react'

export interface WavySliderProps {
	value: number // 0 to 1
	duration: number // seconds
	isPlaying: boolean
	onChange?: (value: number) => void
	cursorImage?: string | null
	primaryColor?: string
}

export const WavySlider: React.FC<WavySliderProps> = ({
	value,
	duration,
	isPlaying,
	onChange,
	primaryColor = '#00AEEC',
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [hoverValue, setHoverValue] = useState<number | null>(null)
	const dragValueRef = useRef<number>(value)

	const phaseRef = useRef(0)
	const amplitudeRef = useRef(0)
	const targetAmplitude = isPlaying ? 3.2 : 0
	const animationFrameId = useRef<number | null>(null)

	const formatTime = (secs: number) => {
		if (!isFinite(secs) || secs < 0) return '0:00'
		const m = Math.floor(secs / 60)
		const s = Math.floor(secs % 60)
		return `${m}:${s < 10 ? '0' : ''}${s}`
	}

	const render = useCallback(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const width = canvas.width
		const height = canvas.height
		const dpr = window.devicePixelRatio || 1

		ctx.clearRect(0, 0, width, height)

		amplitudeRef.current += (targetAmplitude - amplitudeRef.current) * 0.1
		if (isPlaying) {
			phaseRef.current += 0.075
		}

		const midY = height / 2
		const effectiveValue = isDragging ? dragValueRef.current : value
		const progressX = Math.max(0, Math.min(width, effectiveValue * width))

		// 1. Unplayed Track (right of cursor)
		ctx.beginPath()
		ctx.lineWidth = 2 * dpr
		ctx.lineCap = 'round'
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
		ctx.moveTo(progressX, midY)
		ctx.lineTo(width, midY)
		ctx.stroke()

		// Hover preview highlight on unplayed track
		if (hoverValue !== null) {
			const hoverX = hoverValue * width
			if (hoverX > progressX) {
				ctx.beginPath()
				ctx.lineWidth = 2 * dpr
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
				ctx.moveTo(progressX, midY)
				ctx.lineTo(hoverX, midY)
				ctx.stroke()
			}
		}

		// 2. Played Sine Wave (left of cursor) with glow
		ctx.save()
		ctx.beginPath()
		ctx.lineWidth = 2.8 * dpr
		ctx.lineCap = 'round'
		ctx.strokeStyle = primaryColor
		ctx.shadowColor = primaryColor
		ctx.shadowBlur = 6 * dpr

		const omega = 0.04 / dpr
		for (let x = 0; x <= progressX; x += 2) {
			const y =
				midY +
				amplitudeRef.current * dpr * Math.sin(omega * x + phaseRef.current)
			if (x === 0) {
				ctx.moveTo(x, y)
			} else {
				ctx.lineTo(x, y)
			}
		}
		ctx.stroke()
		ctx.restore()

		// 3. Cursor Handle
		const cursorY =
			midY +
			amplitudeRef.current *
				dpr *
				Math.sin(omega * progressX + phaseRef.current)

		const radius = (isDragging || hoverValue !== null ? 6.5 : 5) * dpr
		ctx.save()
		ctx.beginPath()
		ctx.arc(progressX, cursorY, radius, 0, Math.PI * 2)
		ctx.fillStyle = '#FFFFFF'
		ctx.shadowColor = primaryColor
		ctx.shadowBlur = 10 * dpr
		ctx.fill()
		ctx.restore()

		animationFrameId.current = requestAnimationFrame(render)
	}, [value, isPlaying, isDragging, hoverValue, targetAmplitude, primaryColor])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const updateCanvasSize = () => {
			const rect = canvas.getBoundingClientRect()
			const dpr = window.devicePixelRatio || 1
			canvas.width = rect.width * dpr
			canvas.height = rect.height * dpr
		}

		updateCanvasSize()
		window.addEventListener('resize', updateCanvasSize)
		animationFrameId.current = requestAnimationFrame(render)

		return () => {
			window.removeEventListener('resize', updateCanvasSize)
			if (animationFrameId.current) {
				cancelAnimationFrame(animationFrameId.current)
			}
		}
	}, [render])

	const calculateValueFromPointer = (
		e: React.PointerEvent<HTMLCanvasElement>,
	) => {
		const canvas = canvasRef.current
		if (!canvas) return 0
		const rect = canvas.getBoundingClientRect()
		const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
		return x / rect.width
	}

	const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId)
		setIsDragging(true)
		const val = calculateValueFromPointer(e)
		dragValueRef.current = val
	}

	const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const val = calculateValueFromPointer(e)
		setHoverValue(val)
		if (isDragging) {
			dragValueRef.current = val
		}
	}

	const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (isDragging) {
			const val = calculateValueFromPointer(e)
			setIsDragging(false)
			if (onChange) {
				onChange(val)
			}
		}
		e.currentTarget.releasePointerCapture(e.pointerId)
	}

	const displayValue = isDragging ? dragValueRef.current : value

	return (
		<div className="w-full flex items-center gap-3 select-none">
			<span className="text-[10px] font-mono text-muted-foreground/80 w-9 text-right">
				{formatTime(displayValue * duration)}
			</span>
			<div className="relative flex-1 h-5 flex items-center cursor-pointer group">
				{/* Hover Time Tooltip */}
				{hoverValue !== null && duration > 0 && (
					<div
						className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#111827]/95 border border-white/15 text-[10px] font-mono text-white shadow-lg pointer-events-none z-20"
						style={{ left: `${hoverValue * 100}%` }}
					>
						{formatTime(hoverValue * duration)}
					</div>
				)}
				<canvas
					ref={canvasRef}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={() => setHoverValue(null)}
					className="w-full h-full block"
				/>
			</div>
			<span className="text-[10px] font-mono text-muted-foreground/80 w-9 text-left">
				{formatTime(duration)}
			</span>
		</div>
	)
}
```