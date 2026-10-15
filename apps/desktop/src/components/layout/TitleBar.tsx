import React, { useState, useRef, useEffect } from 'react'
import {
	Minus,
	Square,
	X,
	Search,
	Pin,
	History,
	Trash2,
} from 'lucide-react'
import { BiliPlayerLogo } from '../common/BiliPlayerLogo'

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

	const [showHistory, setShowHistory] = useState(false)
	const [history, setHistory] = useState<string[]>(() => {
		try {
			const saved = localStorage.getItem('bili_player_search_history')
			return saved ? JSON.parse(saved) : []
		} catch {
			return []
		}
	})
	const searchContainerRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
				setShowHistory(false)
			}
		}
		window.addEventListener('mousedown', handleClickOutside)
		return () => window.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const saveSearchHistory = (keyword: string) => {
		const trimmed = keyword.trim()
		if (!trimmed) return
		const next = [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, 20)
		setHistory(next)
		localStorage.setItem('bili_player_search_history', JSON.stringify(next))
	}

	const handleRemoveHistoryItem = (e: React.MouseEvent, keyword: string) => {
		e.stopPropagation()
		const next = history.filter((item) => item !== keyword)
		setHistory(next)
		localStorage.setItem('bili_player_search_history', JSON.stringify(next))
	}

	const handleClearAllHistory = (e: React.MouseEvent) => {
		e.stopPropagation()
		setHistory([])
		localStorage.removeItem('bili_player_search_history')
	}

	const handleSelectHistory = (keyword: string) => {
		setQuery(keyword)
		saveSearchHistory(keyword)
		setShowHistory(false)
		if (onSearch) onSearch(keyword)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && onSearch && query.trim()) {
			saveSearchHistory(query)
			setShowHistory(false)
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
				<BiliPlayerLogo size={24} animated={true} />
				<span className="font-bold tracking-tight text-foreground text-[13px] bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
					Bili Player
				</span>
				<span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25 font-mono font-medium">
					PRO
				</span>
			</div>

			{/* Center search pill with history popover */}
			<div
				ref={searchContainerRef}
				className="relative flex-1 max-w-sm focus-within:max-w-md transition-all duration-300 mx-4 pointer-events-auto"
			>
				<div className="relative flex items-center group">
					<Search className="w-3.5 h-3.5 absolute left-3.5 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
					<input
						type="text"
						value={query}
						onFocus={() => setShowHistory(true)}
						onChange={(e) => {
							setQuery(e.target.value)
							setShowHistory(true)
						}}
						onKeyDown={handleKeyDown}
						placeholder="搜索 B 站音乐、歌手、BV号..."
						className="w-full h-8 pl-9 pr-8 text-xs rounded-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-[#0d121f]/95 border border-white/[0.08] focus:border-primary/50 text-foreground placeholder:text-muted-foreground/70 outline-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] focus:ring-2 focus:ring-primary/15 transition-all duration-200"
					/>
					{query && (
						<button
							onClick={() => setQuery('')}
							className="absolute right-2.5 p-0.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						>
							<X className="w-3 h-3" />
						</button>
					)}
				</div>

				{/* Search History Floating Dropdown */}
				{showHistory && (
					<div className="absolute top-full left-0 right-0 mt-2 p-3 rounded-2xl bg-[#0b0f19]/95 backdrop-blur-xl border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.5)] z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
						<div className="flex items-center justify-between pb-2 border-b border-white/5">
							<div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
								<History className="w-3 h-3 text-primary" />
								<span>搜索历史</span>
							</div>
							{history.length > 0 && (
								<button
									onClick={handleClearAllHistory}
									className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-rose-400 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
								>
									<Trash2 className="w-2.5 h-2.5" />
									<span>清空全部</span>
								</button>
							)}
						</div>

						{history.length > 0 ? (
							<div className="flex flex-wrap gap-1.5 pt-2.5 max-h-44 overflow-y-auto no-scrollbar">
								{history.map((kw) => (
									<div
										key={kw}
										onClick={() => handleSelectHistory(kw)}
										className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-primary/20 text-foreground/80 hover:text-white border border-white/5 hover:border-primary/30 transition-all cursor-pointer text-[11px]"
									>
										<span className="truncate max-w-[150px]">{kw}</span>
										<button
											onClick={(e) => handleRemoveHistoryItem(e, kw)}
											className="opacity-40 group-hover:opacity-100 p-0.5 rounded hover:bg-white/15 text-muted-foreground hover:text-white transition-all"
											title="删除此条记录"
										>
											<X className="w-2.5 h-2.5" />
										</button>
									</div>
								))}
							</div>
						) : (
							<div className="py-4 text-center text-muted-foreground/40 text-[11px]">
								暂无搜索历史记录
							</div>
						)}
					</div>
				)}
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