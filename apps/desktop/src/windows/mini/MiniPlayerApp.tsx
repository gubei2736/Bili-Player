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
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'

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
}

export const MiniPlayerApp: React.FC = () => {
	const [state, setState] = useState<MiniPlayerState>({
		title: '茜',
		artist: 'ヨルシカ',
		coverUrl: '',
		currentTime: 62,
		duration: 225,
		isPlaying: false,
		playMode: 'repeat_all',
		volume: 0.8,
		isMuted: false,
	})

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
		emit('global-shortcut-event', 'play_pause').catch(() => {})
	}

	const handlePrev = () => {
		emit('global-shortcut-event', 'prev_track').catch(() => {})
	}

	const handleNext = () => {
		emit('global-shortcut-event', 'next_track').catch(() => {})
	}

	const handleToggleMute = () => {
		emit('player-toggle-mute').catch(() => {})
	}

	const handleToggleMode = () => {
		emit('player-toggle-mode').catch(() => {})
	}

	const handleRestoreMain = () => {
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
		emit('player-seek', targetSec).catch(() => {})
		setState((prev) => ({ ...prev, currentTime: targetSec }))
	}

	const displayTime = isDraggingSeek && seekTime !== null ? seekTime : state.currentTime
	const progressPct =
		state.duration > 0
			? Math.max(0, Math.min(100, (displayTime / state.duration) * 100))
			: 0

	return (
		<div
			data-tauri-drag-region
			className="w-full h-full bg-white select-none rounded-[26px] p-2.5 flex flex-col justify-between shadow-[0_12px_36px_rgba(0,0,0,0.35)] border border-gray-100/90 relative cursor-move overflow-hidden"
		>
			{/* Top Control Bar */}
			<div
				data-tauri-drag-region
				className="flex items-center justify-between w-full gap-2"
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
							className="w-10 h-10 rounded-2xl object-cover bg-gray-100 flex-shrink-0 shadow-sm pointer-events-none"
						/>
					) : (
						<div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00AEEC]/15 to-[#5255F4]/20 flex items-center justify-center flex-shrink-0 text-[#5255F4]">
							<Music className="w-4 h-4" />
						</div>
					)}

					<div data-tauri-drag-region className="min-w-0 flex-1">
						<p
							data-tauri-drag-region
							className="text-xs font-bold text-gray-900 truncate leading-tight tracking-tight"
						>
							{state.title || '暂无播放歌曲'}
						</p>
						<p
							data-tauri-drag-region
							className="text-[10px] text-gray-400 truncate mt-0.5 font-medium"
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
						className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
					>
						<SkipBack className="w-3.5 h-3.5" />
					</button>

					<button
						onClick={handlePlayPause}
						title={state.isPlaying ? '暂停' : '播放'}
						className="w-8 h-8 rounded-full bg-[#5255F4] hover:bg-[#4346E2] text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
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
						className="p-1 rounded-full text-gray-700 hover:text-gray-950 hover:bg-gray-100 transition-colors"
					>
						<SkipForward className="w-3.5 h-3.5" />
					</button>

					<button
						onClick={handleToggleMute}
						title={state.isMuted ? '取消静音' : '静音'}
						className="p-1 rounded-full text-gray-700 hover:text-gray-950 hover:bg-gray-100 transition-colors"
					>
						{state.isMuted || state.volume === 0 ? (
							<VolumeX className="w-3.5 h-3.5 text-rose-500" />
						) : (
							<Volume2 className="w-3.5 h-3.5" />
						)}
					</button>

					<button
						onClick={handleToggleMode}
						title="切换循环模式"
						className="p-1 rounded-full text-gray-700 hover:text-gray-950 hover:bg-gray-100 transition-colors"
					>
						{state.playMode === 'repeat_one' ? (
							<Repeat1 className="w-3.5 h-3.5 text-[#5255F4]" />
						) : state.playMode === 'shuffle' ? (
							<Shuffle className="w-3.5 h-3.5 text-[#5255F4]" />
						) : (
							<Repeat className="w-3.5 h-3.5" />
						)}
					</button>

					<button
						onClick={handleRestoreMain}
						title="展开完整主界面"
						className="p-1 rounded-full text-gray-700 hover:text-gray-950 hover:bg-gray-100 transition-colors"
					>
						<ListMusic className="w-3.5 h-3.5" />
					</button>

					<button
						onClick={handleRestoreMain}
						title="返回主界面 (关闭迷你模式)"
						className="w-5 h-5 rounded-md border border-gray-200 hover:bg-rose-50 hover:border-rose-200 text-gray-400 hover:text-rose-500 flex items-center justify-center transition-colors ml-0.5"
					>
						<X className="w-3 h-3" />
					</button>
				</div>
			</div>

			{/* Bottom Progress Bar */}
			<div
				data-tauri-drag-region
				className="flex items-center gap-2 px-1 pt-0.5 w-full"
			>
				<span className="text-[10px] font-bold font-mono text-[#5255F4] w-6 text-right shrink-0">
					{formatTime(displayTime)}
				</span>

				<div
					ref={progressRef}
					onClick={handleProgressClick}
					className="relative flex-1 h-1 bg-gray-200/90 rounded-full cursor-pointer group/bar flex items-center"
				>
					<div
						className="h-full bg-[#5255F4] rounded-full relative transition-all"
						style={{ width: `${progressPct}%` }}
					>
						<div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#5255F4] ring-2 ring-white shadow-sm pointer-events-none group-hover/bar:scale-125 transition-transform" />
					</div>
				</div>

				<span className="text-[10px] font-bold font-mono text-gray-400 w-6 text-left shrink-0">
					{formatTime(state.duration)}
				</span>
			</div>
		</div>
	)
}
