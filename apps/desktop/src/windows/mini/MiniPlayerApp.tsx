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
	const progressRef = useRef<HTMLDivElement>(null)
	const [isDraggingSeek, setIsDraggingSeek] = useState(false)
	const [seekTime, setSeekTime] = useState<number | null>(null)

	useEffect(() => {
		const unlistenSyncPromise = listen<Partial<MiniPlayerState>>(
			'mini-player-state-sync',
			(event) => {
				setState((prev) => ({ ...prev, ...event.payload }))
			},
		)

		// Ask main window for current state on mount
		invoke('player_request_sync').catch(() => {})
		emit('mini-player-request-sync').catch(() => {})

		return () => {
			unlistenSyncPromise.then((unlisten) => unlisten())
		}
	}, [])

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

	const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!progressRef.current || state.duration <= 0) return
		const rect = progressRef.current.getBoundingClientRect()
		const clickPct = Math.max(
			0,
			Math.min(1, (e.clientX - rect.left) / rect.width),
		)
		const targetSec = clickPct * state.duration
		setState((prev) => ({ ...prev, currentTime: targetSec }))
		invoke('player_seek', { position: targetSec }).catch(() => {})
	}

	const displayTime = isDraggingSeek && seekTime !== null ? seekTime : state.currentTime
	const progressPct =
		state.duration > 0
			? Math.max(0, Math.min(100, (displayTime / state.duration) * 100))
			: 0

	const currentQueue = state.queue || []

	return (
		// Outer transparent padding container to prevent window edges from clipping rounded corners and shadows
		<div
			data-tauri-drag-region
			className="w-full h-full p-1.5 flex flex-col items-center justify-start bg-transparent select-none cursor-move"
		>
			{/* Rounded Pill Card: Default Dark theme with anti-aliasing buffer and clean curves */}
			<div
				data-tauri-drag-region
				style={{
					transform: 'translateZ(0)',
					backfaceVisibility: 'hidden',
				}}
				className="w-full h-full bg-[#0c101c] text-white rounded-[22px] px-3 py-2.5 flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_32px_rgba(0,0,0,0.65)] border border-white/10 relative overflow-hidden"
			>
				{/* Top Controls Bar */}
				<div
					data-tauri-drag-region
					className="flex items-center justify-between w-full gap-2.5 flex-shrink-0"
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

				{/* Bottom Progress Bar */}
				<div
					data-tauri-drag-region
					className="flex items-center gap-2 px-1 pt-2 w-full flex-shrink-0"
				>
					<span className="text-[10px] font-mono text-[#00AEEC] w-6 text-right shrink-0">
						{formatTime(displayTime)}
					</span>

					<div
						ref={progressRef}
						onClick={handleProgressClick}
						className="relative flex-1 h-1 bg-white/10 rounded-full cursor-pointer group/bar flex items-center"
					>
						<div
							className="h-full bg-gradient-to-r from-[#00A1D6] to-[#00AEEC] rounded-full relative transition-all"
							style={{ width: `${progressPct}%` }}
						>
							<div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-[#00AEEC] shadow-md pointer-events-none group-hover/bar:scale-125 transition-transform" />
						</div>
					</div>

					<span className="text-[10px] font-mono text-white/40 w-6 text-left shrink-0">
						{formatTime(state.duration)}
					</span>
				</div>

				{/* Expanded In-Window Play Queue Drawer */}
				{isExpanded && (
					<div className="flex-1 flex flex-col min-h-0 pt-2.5 mt-2 border-t border-white/10">
						{/* Header row */}
						<div className="flex items-center justify-between pb-1.5 px-1 flex-shrink-0 text-white/70">
							<div className="flex items-center gap-1.5 text-[11px] font-medium text-white/90">
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
							<div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-mini-scrollbar">
								{currentQueue.map((item, idx) => {
									const isCurrent = idx === state.currentIndex
									return (
										<div
											key={item.uniqueKey || idx}
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
													<p className={`truncate font-medium text-[11px] ${
														isCurrent ? 'text-[#00AEEC] font-semibold' : 'text-white/90'
													}`}>
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

