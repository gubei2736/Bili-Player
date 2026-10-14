import React, { useState } from 'react'
import {
	Minus,
	Square,
	X,
	Search,
	Pin,
	Disc3,
} from 'lucide-react'

export interface TitleBarProps {
	onSearch?: (query: string) => void
	onToggleLyricsWindow?: () => void
}

export const TitleBar: React.FC<TitleBarProps> = ({
	onSearch,
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
			const action = localStorage.getItem('bbplayer_close_action') || 'tray'
			const { getCurrentWindow } = await import('@tauri-apps/api/window')
			const win = getCurrentWindow()
			if (action === 'tray') {
				await win.hide()
			} else {
				await win.close()
			}
		} catch {
			window.close()
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