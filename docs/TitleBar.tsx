import React, { useState, useEffect } from 'react'
import {
	Minus,
	Square,
	X,
	Search,
	Pin,
	Volume2,
	Music,
	Sparkles,
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
		} catch {
			// Web preview fallback
		}
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
		} catch {
			// Web preview fallback
		}
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
		if (e.key === 'Enter' && onSearch) {
			onSearch(query.trim())
		}
	}

	return (
		<header
			data-tauri-drag-region
			className="h-11 w-full flex items-center justify-between px-3 select-none bg-background/40 backdrop-blur-md border-b border-white/5 z-50 text-xs"
		>
			{/* Left branding */}
			<div className="flex items-center gap-2.5 pointer-events-none">
				<div className="w-5 h-5 rounded-md bg-gradient-to-tr from-pink-500 to-sky-400 flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
					BB
				</div>
				<span className="font-semibold tracking-wide text-foreground/85 text-xs">
					BBPlayer
				</span>
				<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground font-mono">
					v2.0 Desktop
				</span>
			</div>

			{/* Center search bar */}
			<div className="flex-1 max-w-md mx-4 pointer-events-auto">
				<div className="relative flex items-center">
					<Search className="w-3.5 h-3.5 absolute left-3 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="搜索 B 站视频、BV号、UP主或音乐..."
						className="w-full h-7 pl-8 pr-3 text-xs rounded-full bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200"
					/>
				</div>
			</div>

			{/* Right actions & Window controls */}
			<div className="flex items-center gap-1">
				{onToggleLyricsWindow && (
					<button
						onClick={onToggleLyricsWindow}
						title="桌面歌词 (Alt+Shift+L)"
						className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
					>
						<Sparkles className="w-3.5 h-3.5" />
					</button>
				)}

				<button
					onClick={handleTogglePin}
					title={isAlwaysOnTop ? '取消置顶' : '置顶窗口'}
					className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${
						isAlwaysOnTop ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<Pin className="w-3.5 h-3.5" />
				</button>

				<div className="h-4 w-px bg-white/10 mx-1" />

				<button
					onClick={handleMinimize}
					title="最小化"
					className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
				>
					<Minus className="w-3.5 h-3.5" />
				</button>

				<button
					onClick={handleMaximize}
					title={isMaximized ? '还原' : '最大化'}
					className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
				>
					<Square className="w-3 h-3" />
				</button>

				<button
					onClick={handleClose}
					title="关闭"
					className="p-1.5 rounded-md hover:bg-red-500/80 hover:text-white text-muted-foreground transition-colors"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>
		</header>
	)
}
