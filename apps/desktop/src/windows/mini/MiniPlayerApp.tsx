import React, { useState, useEffect, useRef } from 'react'
import {
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	Repeat,
	Repeat1,
	Shuffle,
	ListMusic,
	X,
	Music,
	ChevronDown,
	Disc3,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'

export interface MiniQueueItem {
	uniqueKey: string
	title: string
	artist: string
	duration: number
	coverUrl: string
}

export interface MiniPlayerState {
	title: string
	artist: string
	coverUrl: string
	currentTime: number
	duration: number
	isPlaying: boolean
	playMode: 'sequential' | 'repeat_all' | 'repeat_one' | 'shuffle'
	volume: number
	isMuted: boolean
	queue?: MiniQueueItem[]
	currentIndex?: number
}

export const MiniPlayerApp: React.FC = () => {
	const [state, setState] = useState<MiniPlayerState>({
		title: '',
		artist: '',
		coverUrl: '',
		currentTime: 0,
		duration: 0,
		isPlaying: false,
		playMode: 'repeat_all',
		volume: 0.5,
		isMuted: false,
		queue: [],
		currentIndex: -1,
	})

	const [isExpanded, setIsExpanded] = useState(false)
	const queueListRef = useRef<HTMLDivElement>(null)
	const currentTrackRef = useRef<HTMLDivElement>(null)

	// --- 进度条系统：与主界面完全一致的 60FPS 平滑插值与 Pointer Capture 拖拽方案 ---
	const progressBarRef = useRef<HTMLDivElement>(null)
	const progressBarFillRef = useRef<HTMLDivElement>(null)
	const progressThumbRef = useRef<HTMLDivElement>(null)
	const timeTextSpanRef = useRef<HTMLSpanElement>(null)

	const [isDragging, setIsDragging] = useState(false)
	const [dragProgress, setDragProgress] = useState(0)
	const [hoverProgress, setHoverProgress] = useState<number | null>(null)
	const [displayTime, setDisplayTime] = useState(state.currentTime)

	// 本地 60FPS 平滑插值锚点
	const syncAnchorRef = useRef({
		baseTime: state.currentTime,
		perfNow: performance.now(),
		isPlaying: state.isPlaying,
	})

	useEffect(() => {
		const unlistenSyncPromise = listen<Partial<MiniPlayerState>>(
			'mini-player-state-sync',
			(event) => {
				setState((prev) => {
					const next = { ...prev, ...event.payload }
					if (event.payload.currentTime !== undefined) {
						syncAnchorRef.current.baseTime = event.payload.currentTime
						syncAnchorRef.current.perfNow = performance.now()
						if (!isDragging) {
							setDisplayTime(event.payload.currentTime)
						}
					}
					if (event.payload.isPlaying !== undefined) {
						syncAnchorRef.current.isPlaying = event.payload.isPlaying
					}
					return next
				})
			},
		)

		// Ask main window for current state on mount
		invoke('player_request_sync').catch(() => {})
		emit('mini-player-request-sync').catch(() => {})

		return () => {
			unlistenSyncPromise.then((unlisten) => unlisten())
		}
	}, [isDragging])

	// 60FPS 本地平滑推进循环：消除跨窗口广播频率限制带来的顿挫感，与主界面完全一致
	useEffect(() => {
		if (!state.isPlaying || isDragging) return

		let animId: number
		let lastTick = 0
		const tick = (now: number) => {
			if (!isDragging) {
				if (now - lastTick >= 16) {
					lastTick = now
					const { baseTime, perfNow, isPlaying } = syncAnchorRef.current
					if (isPlaying && state.duration > 0) {
						const elapsed = (performance.now() - perfNow) / 1000
						const cur = Math.min(state.duration, baseTime + elapsed)
						setDisplayTime(cur)
						const pct = (cur / state.duration) * 100
						if (progressBarFillRef.current) {
							progressBarFillRef.current.style.width = `${pct}%`
						}
						if (progressThumbRef.current) {
							progressThumbRef.current.style.left = `${pct}%`
						}
						if (timeTextSpanRef.current) {
							timeTextSpanRef.current.textContent = formatTime(cur)
						}
					}
				}
			}
			animId = requestAnimationFrame(tick)
		}

		animId = requestAnimationFrame(tick)
		return () => {
			if (animId) cancelAnimationFrame(animId)
		}
	}, [state.isPlaying, isDragging, state.duration])

	// 当列表展开或当前曲目变更时，自动平滑滚动到当前曲目视口
	useEffect(() => {
		if (isExpanded && currentTrackRef.current) {
			currentTrackRef.current.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			})
		}
	}, [isExpanded, state.currentIndex])

	const formatTime = (secs: number) => {
		if (!isFinite(secs) || secs < 0) return '0:00'
		const m = Math.floor(secs / 60)
		const s = Math.floor(secs % 60)
		return `${m}:${s < 10 ? '0' : ''}${s}`
	}

	const handlePlayPause = () => {
		invoke('trigger_player_action', { action: 'play_pause' }).catch(() => {})
		emit('global-shortcut-event', 'play_pause').catch(() => {})
	}

	const handlePrev = () => {
		invoke('trigger_player_action', { action: 'prev_track' }).catch(() => {})
		emit('global-shortcut-event', 'prev_track').catch(() => {})
	}

	const handleNext = () => {
		invoke('trigger_player_action', { action: 'next_track' }).catch(() => {})
		emit('global-shortcut-event', 'next_track').catch(() => {})
	}

	const handleToggleMute = () => {
		setState((prev) => ({ ...prev, isMuted: !prev.isMuted }))
		invoke('player_toggle_mute').catch(() => {})
	}

	const handleToggleMode = () => {
		const nextMode =
			state.playMode === 'sequential'
				? 'repeat_all'
				: state.playMode === 'repeat_all'
				? 'repeat_one'
				: state.playMode === 'repeat_one'
				? 'shuffle'
				: 'sequential'
		setState((prev) => ({ ...prev, playMode: nextMode }))
		invoke('player_toggle_mode').catch(() => {})
	}

	const handleToggleList = () => {
		const nextExpanded = !isExpanded
		setIsExpanded(nextExpanded)
		invoke('set_mini_player_expanded', { expanded: nextExpanded }).catch(() => {})
	}

	const handlePlayIndex = (index: number) => {
		invoke('play_queue_index', { index }).catch(() => {})
	}

	const handleRestoreMain = () => {
		if (isExpanded) {
			setIsExpanded(false)
			invoke('set_mini_player_expanded', { expanded: false }).catch(() => {})
		}
		invoke('restore_main_from_mini').catch(() => {})
	}

	// 进度条交互计算：指针捕获 + 实时拖拽更新
	const calculateProgressFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
		const bar = progressBarRef.current
		if (!bar) return 0
		const rect = bar.getBoundingClientRect()
		const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
		return rect.width > 0 ? x / rect.width : 0
	}

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId)
		setIsDragging(true)
		const p = calculateProgressFromPointer(e)
		setDragProgress(p)
		const targetSec = p * state.duration
		setDisplayTime(targetSec)
		if (timeTextSpanRef.current) {
			timeTextSpanRef.current.textContent = formatTime(targetSec)
		}
		if (progressBarFillRef.current) {
			progressBarFillRef.current.style.width = `${p * 100}%`
		}
		if (progressThumbRef.current) {
			progressThumbRef.current.style.left = `${p * 100}%`
		}
	}

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const p = calculateProgressFromPointer(e)
		setHoverProgress(p)
		if (isDragging) {
			setDragProgress(p)
			const targetSec = p * state.duration
			setDisplayTime(targetSec)
			if (timeTextSpanRef.current) {
				timeTextSpanRef.current.textContent = formatTime(targetSec)
			}
			if (progressBarFillRef.current) {
				progressBarFillRef.current.style.width = `${p * 100}%`
			}
			if (progressThumbRef.current) {
				progressThumbRef.current.style.left = `${p * 100}%`
			}
		}
	}

	const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (isDragging) {
			const p = calculateProgressFromPointer(e)
			setIsDragging(false)
			const targetSec = p * state.duration
			setDisplayTime(targetSec)
			syncAnchorRef.current.baseTime = targetSec
			syncAnchorRef.current.perfNow = performance.now()
			setState((prev) => ({ ...prev, currentTime: targetSec }))
			invoke('player_seek', { position: targetSec }).catch(() => {})
		}
		try {
			e.currentTarget.releasePointerCapture(e.pointerId)
		} catch {}
	}

	const effectiveProgress =
		isDragging
			? dragProgress
			: state.duration > 0
			? Math.max(0, Math.min(1, displayTime / state.duration))
			: 0

	const currentQueue = state.queue || []

	return (
		// Mini Player Root: seamless zero-padding card without outer black shadows
		<div className="w-full h-full max-h-full p-0 flex flex-col bg-transparent select-none overflow-hidden">
			{/* Rounded Pill Card: Clean border, solid dark background, zero outer shadows */}
			<div
				style={{
					transform: 'translateZ(0)',
					backfaceVisibility: 'hidden',
				}}
				className="w-full h-full max-h-full bg-[#0c101c] text-white rounded-2xl px-3.5 py-2.5 flex flex-col border border-white/15 relative overflow-hidden"
			>
				{/* Top Controls Bar */}
				<div
					data-tauri-drag-region
					className="flex items-center justify-between w-full gap-2.5 flex-shrink-0 cursor-move"
				>
					{/* Track Cover & Meta */}
					<div
						data-tauri-drag-region
						className="flex items-center gap-2.5 min-w-0 flex-1"
					>
						{state.coverUrl ? (
							<img
								src={state.coverUrl}
								alt={state.title}
								className="w-10 h-10 rounded-xl object-cover bg-black/50 flex-shrink-0 shadow-sm ring-1 ring-white/10 pointer-events-none"
							/>
						) : (
							<div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-white/30">
								<Music className="w-4 h-4 text-[#00AEEC]" />
							</div>
						)}

						<div data-tauri-drag-region className="min-w-0 flex-1">
							<p
								data-tauri-drag-region
								className="text-xs font-bold text-white/95 truncate leading-tight tracking-tight"
								title={state.title || '暂无播放歌曲'}
							>
								{state.title || '暂无播放歌曲'}
							</p>
							<p
								data-tauri-drag-region
								className="text-[10px] text-white/45 truncate mt-0.5 font-medium"
							>
								{state.artist || 'Bili Player'}
							</p>
						</div>
					</div>

					{/* Playback Controls Row */}
					<div className="flex items-center gap-1 flex-shrink-0">
						<button
							onClick={handlePrev}
							title="上一首"
							className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
						>
							<SkipBack className="w-3.5 h-3.5" />
						</button>

						<button
							onClick={handlePlayPause}
							title={state.isPlaying ? '暂停' : '播放'}
							className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#00A1D6] to-[#00AEEC] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,174,236,0.35)] hover:brightness-110 active:scale-95 transition-all"
						>
							{state.isPlaying ? (
								<Pause className="w-3.5 h-3.5 fill-white" />
							) : (
								<Play className="w-3.5 h-3.5 fill-white ml-0.5" />
							)}
						</button>

						<button
							onClick={handleNext}
							title="下一首"
							className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
						>
							<SkipForward className="w-3.5 h-3.5" />
						</button>

						<button
							onClick={handleToggleMute}
							title={state.isMuted || state.volume === 0 ? '取消静音' : '静音'}
							className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
						>
							{state.isMuted || state.volume === 0 ? (
								<VolumeX className="w-3.5 h-3.5 text-rose-400" />
							) : (
								<Volume2 className="w-3.5 h-3.5" />
							)}
						</button>

						<button
							onClick={handleToggleMode}
							title={`播放模式: ${
								state.playMode === 'repeat_one'
									? '单曲循环'
									: state.playMode === 'repeat_all'
									? '列表循环'
									: state.playMode === 'shuffle'
									? '随机播放'
									: '顺序播放'
							}`}
							className={`p-1 rounded-full transition-colors ${
								state.playMode !== 'sequential'
									? 'text-[#00AEEC] hover:text-[#00AEEC] hover:bg-[#00AEEC]/10'
									: 'text-white/40 hover:text-white hover:bg-white/10'
							}`}
						>
							{state.playMode === 'repeat_one' ? (
								<Repeat1 className="w-3.5 h-3.5" />
							) : state.playMode === 'shuffle' ? (
								<Shuffle className="w-3.5 h-3.5" />
							) : (
								<Repeat className="w-3.5 h-3.5" />
							)}
						</button>

						<button
							onClick={handleToggleList}
							title={isExpanded ? '收起播放列表' : '在迷你窗口查看播放列表'}
							className={`p-1 rounded-full transition-colors ${
								isExpanded
									? 'text-[#00AEEC] bg-[#00AEEC]/20 shadow-sm'
									: 'text-white/50 hover:text-[#00AEEC] hover:bg-white/10'
							}`}
						>
							<ListMusic className="w-3.5 h-3.5" />
						</button>

						<button
							onClick={handleRestoreMain}
							title="返回主界面 (关闭迷你模式)"
							className="w-5 h-5 rounded-md border border-white/15 hover:border-rose-400/50 hover:bg-rose-500/10 text-white/40 hover:text-rose-400 flex items-center justify-center transition-all ml-0.5"
						>
							<X className="w-3 h-3" />
						</button>
					</div>
				</div>

				{/* Bottom Progress Bar - 与主界面完全相同的一体化方案 */}
				<div
					data-tauri-drag-region
					className="flex items-center gap-2 px-1 pt-1.5 w-full flex-shrink-0"
				>
					{/* Current Time */}
					<span
						ref={timeTextSpanRef}
						className="text-[10px] font-mono font-bold text-[#00AEEC] min-w-[32px] text-right shrink-0 select-none"
					>
						{formatTime(isDragging ? dragProgress * state.duration : displayTime)}
					</span>

					{/* Straight Progress Track */}
					<div
						ref={progressBarRef}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						onPointerLeave={() => setHoverProgress(null)}
						className="relative flex-1 h-3 flex items-center cursor-pointer group/progress"
					>
						{/* Hover Tooltip Capsule */}
						{hoverProgress !== null && state.duration > 0 && (
							<div
								className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-[#0d1322]/95 border border-white/20 text-[9px] font-mono font-bold text-white shadow-xl pointer-events-none z-30 flex items-center gap-1 backdrop-blur-md"
								style={{
									left: `${Math.max(4, Math.min(96, hoverProgress * 100))}%`,
								}}
							>
								<span className="w-1 h-1 rounded-full bg-[#00AEEC] animate-pulse" />
								{formatTime(hoverProgress * state.duration)}
							</div>
						)}

						{/* Background Line */}
						<div className="w-full h-[3px] group-hover/progress:h-[4px] rounded-full bg-white/10 group-hover/progress:bg-white/15 transition-[height,background-color] duration-150 overflow-hidden relative">
							{/* Played Progress Line */}
							<div
								ref={progressBarFillRef}
								className="h-full rounded-full bg-[#00AEEC]"
								style={{
									width: `${Math.max(0, Math.min(100, effectiveProgress * 100))}%`,
								}}
							/>
						</div>

						{/* Thumb circle */}
						<div
							ref={progressThumbRef}
							className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border border-white/80 pointer-events-none transition-[opacity,transform] duration-150 ${
								isDragging
									? 'opacity-100 scale-125'
									: 'opacity-0 group-hover/progress:opacity-100 group-hover/progress:scale-110'
							}`}
							style={{
								left: `${Math.max(0, Math.min(100, effectiveProgress * 100))}%`,
								boxShadow: '0 0 6px #00AEEC, 0 2px 4px rgba(0,0,0,0.5)',
							}}
						/>
					</div>

					{/* Total Duration */}
					<span className="text-[10px] font-mono font-bold text-white/40 min-w-[32px] text-left shrink-0 select-none">
						{formatTime(state.duration)}
					</span>
				</div>

				{/* Expanded In-Window Play Queue Drawer */}
				{isExpanded && (
					<div className="flex-1 flex flex-col min-h-0 pt-2 mt-2 border-t border-white/10 overflow-hidden">
						{/* Header row - draggable */}
						<div
							data-tauri-drag-region
							className="flex items-center justify-between pb-1.5 px-1 flex-shrink-0 text-white/70 cursor-move"
						>
							<div
								data-tauri-drag-region
								className="flex items-center gap-1.5 text-[11px] font-medium text-white/90"
							>
								<Disc3 className="w-3.5 h-3.5 text-[#00AEEC] animate-[spin_6s_linear_infinite]" />
								<span>当前播放队列</span>
								<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-white/60">
									{currentQueue.length}
								</span>
							</div>
							<button
								onClick={handleToggleList}
								className="text-[10px] text-white/40 hover:text-white flex items-center gap-0.5 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors"
								title="收起列表"
							>
								<span>收起</span>
								<ChevronDown className="w-3 h-3" />
							</button>
						</div>

						{/* Queue List Scroll Container */}
						{currentQueue.length === 0 ? (
							<div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-white/40">
								<Music className="w-7 h-7 mb-1.5 opacity-30 text-[#00AEEC]" />
								<p className="text-xs">播放队列暂无歌曲</p>
								<p className="text-[10px] text-white/30 mt-0.5">请在主界面添加歌曲播放</p>
							</div>
						) : (
							<div
								ref={queueListRef}
								onWheel={(e) => {
									e.stopPropagation()
									if (queueListRef.current) {
										queueListRef.current.scrollTop += e.deltaY
									}
								}}
								className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 pb-1.5 custom-mini-scrollbar select-none cursor-default"
								style={{ overscrollBehavior: 'contain' }}
							>
								{currentQueue.map((item, idx) => {
									const isCurrent = idx === state.currentIndex
									return (
										<div
											key={item.uniqueKey || idx}
											ref={isCurrent ? currentTrackRef : undefined}
											onClick={() => handlePlayIndex(idx)}
											className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
												isCurrent
													? 'bg-[#00AEEC]/15 border border-[#00AEEC]/30 text-[#00AEEC]'
													: 'hover:bg-white/5 text-white/80 hover:text-white'
											}`}
										>
											<div className="flex items-center gap-2 min-w-0 flex-1">
												<span className="w-4 text-[10px] font-mono text-center flex-shrink-0 opacity-50 group-hover:hidden">
													{isCurrent ? '▶' : (idx + 1).toString().padStart(2, '0')}
												</span>
												<div className="w-4 hidden group-hover:flex items-center justify-center text-[#00AEEC] flex-shrink-0">
													<Play className="w-3 h-3 fill-current" />
												</div>

												{item.coverUrl ? (
													<img
														src={item.coverUrl}
														alt=""
														className="w-6 h-6 rounded-md object-cover flex-shrink-0 bg-black/40 ring-1 ring-white/5"
													/>
												) : (
													<div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 text-white/30">
														<Music className="w-3 h-3" />
													</div>
												)}

												<div className="min-w-0 flex-1 leading-tight">
													<p
														className={`truncate font-medium text-[11px] ${
															isCurrent ? 'text-[#00AEEC] font-semibold' : 'text-white/90'
														}`}
													>
														{item.title}
													</p>
													<p className="text-[9px] text-white/40 truncate">
														{item.artist}
													</p>
												</div>
											</div>

											<span className="text-[10px] font-mono text-white/40 ml-2 flex-shrink-0">
												{formatTime(item.duration)}
											</span>
										</div>
									)
								})}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

