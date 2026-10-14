import React, { useState, useEffect, useMemo, useRef } from 'react'
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
	Radio,
	Heart,
	ListMusic,
	Mic,
	Clapperboard,
	Monitor,
	Disc3,
	X,
	Trash2,
} from 'lucide-react'
import { useQueueStore, type BilibiliTrack } from '@bbplayer/shared-core'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import { getQualityBadgeInfo } from '../../audio/audioSettings'
import { parseSpl } from '@bbplayer/splash'
import {
	lyricService,
	getStoredLyricOffset,
} from '../../services/lyricService'
import { LyricsSettingsModal } from '../modals/LyricsSettingsModal'

export interface BottomPlayerBarProps {
	onToggleFullscreenLyrics?: () => void
	onToggleLyricsWindow?: () => void
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
	onToggleFullscreenLyrics,
	onToggleLyricsWindow,
}) => {
	const {
		queue,
		playMode,
		setPlayMode,
		next,
		prev,
		getCurrentTrack,
		setCurrentIndex,
		clearQueue,
	} = useQueueStore()

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
	const [queueOpen, setQueueOpen] = useState(false)
	const [isLiked, setIsLiked] = useState(false)

	// Progress bar drag & hover states
	const [isDragging, setIsDragging] = useState(false)
	const [dragProgress, setDragProgress] = useState(0)
	const [hoverProgress, setHoverProgress] = useState<number | null>(null)
	const progressBarRef = useRef<HTMLDivElement | null>(null)

	// 1. Auto fetch lyrics & offset on track change
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

	// 2. Favorite state sync with localStorage
	useEffect(() => {
		if (!currentTrack) {
			setIsLiked(false)
			return
		}
		try {
			const saved = JSON.parse(
				localStorage.getItem('bbplayer_favorites_keys') || '[]',
			)
			setIsLiked(Array.isArray(saved) && saved.includes(currentTrack.uniqueKey))
		} catch {
			setIsLiked(false)
		}
	}, [currentTrack?.uniqueKey])

	const toggleLike = () => {
		if (!currentTrack) return
		try {
			const saved: string[] = JSON.parse(
				localStorage.getItem('bbplayer_favorites_keys') || '[]',
			)
			const idx = saved.indexOf(currentTrack.uniqueKey)
			let nextList: string[]
			if (idx >= 0) {
				nextList = saved.filter((k) => k !== currentTrack.uniqueKey)
				setIsLiked(false)
			} else {
				nextList = [currentTrack.uniqueKey, ...saved]
				setIsLiked(true)
			}
			localStorage.setItem('bbplayer_favorites_keys', JSON.stringify(nextList))
		} catch {}
	}

	// 3. Listen for custom lyric & offset events
	useEffect(() => {
		const handleCustomLyric = (e: any) => {
			if (e.detail?.trackKey === currentTrack?.uniqueKey) {
				setSplContent(e.detail.splContent)
			}
		}
		const handleOffsetChange = (e: any) => {
			if (currentTrack && e.detail?.trackKey === currentTrack.uniqueKey) {
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

	// 4. Audio Engine event subscription (with single-song replay fix)
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

	// 5. Media Session handlers
	useEffect(() => {
		desktopAudioEngine.setupMediaSessionHandlers({
			onPlay: () => desktopAudioEngine.play(),
			onPause: () => desktopAudioEngine.pause(),
			onNext: () => next(),
			onPrev: () => prev(),
			onSeek: (time) => desktopAudioEngine.seek(time),
		})
	}, [next, prev])

	// 6. Auto play on currentTrack change
	useEffect(() => {
		if (
			currentTrack &&
			currentTrack.uniqueKey !== desktopAudioEngine.getCurrentTrack()?.uniqueKey
		) {
			playTrackWithProxy(currentTrack).catch((err) =>
				console.error('Failed to auto play track:', err),
			)
		}
	}, [currentTrack?.uniqueKey])

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
			const restoreVal = volume > 0 ? volume : 0.8
			setIsMuted(false)
			desktopAudioEngine.setVolume(restoreVal)
		} else {
			setIsMuted(true)
			desktopAudioEngine.setVolume(0)
		}
	}

	const toggleLoudnessNormalization = () => {
		const nextState = !loudnessEnabled
		setLoudnessEnabled(nextState)
		desktopAudioEngine.setLoudnessNormalization(nextState)
	}

	const toggleShuffle = () => {
		setPlayMode(playMode === 'shuffle' ? 'sequential' : 'shuffle')
	}

	const toggleLoopMode = () => {
		if (playMode === 'sequential') setPlayMode('repeat_all')
		else if (playMode === 'repeat_all') setPlayMode('repeat_one')
		else setPlayMode('sequential')
	}

	const handleOpenSourceVideo = () => {
		if (!biliTrack) return
		const bvid = biliTrack.bilibiliMetadata?.bvid
		if (!bvid) return
		window.open(`https://www.bilibili.com/video/${bvid}`, '_blank')
	}

	const handleToggleDesktopLyrics = async () => {
		if (onToggleLyricsWindow) {
			onToggleLyricsWindow()
		} else {
			try {
				const { invoke } = await import('@tauri-apps/api/core')
				await invoke('toggle_lyrics')
			} catch {}
		}
	}

	const formatTime = (secs: number) => {
		if (!isFinite(secs) || secs < 0) return '0:00'
		const m = Math.floor(secs / 60)
		const s = Math.floor(secs % 60)
		return `${m}:${s < 10 ? '0' : ''}${s}`
	}

	// Interactive seek calculations
	const calculateProgressFromPointer = (
		e: React.PointerEvent<HTMLDivElement>,
	) => {
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
	}

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const p = calculateProgressFromPointer(e)
		setHoverProgress(p)
		if (isDragging) {
			setDragProgress(p)
		}
	}

	const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (isDragging) {
			const p = calculateProgressFromPointer(e)
			setIsDragging(false)
			handleSeek(p)
		}
		e.currentTarget.releasePointerCapture(e.pointerId)
	}

	const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0
	const effectiveProgress = isDragging ? dragProgress : progress
	const effectiveVolumePct = (isMuted ? 0 : volume) * 100

	return (
		<footer className="h-[92px] w-full flex items-center justify-between px-6 select-none bg-[#0a0f19]/92 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-10px_35px_rgba(0,0,0,0.5)] z-40 relative overflow-visible">
			{/* Soft atmospheric gradient wash matching reference screenshot */}
			<div className="absolute inset-0 bg-gradient-to-r from-emerald-950/15 via-transparent to-rose-950/15 pointer-events-none" />

			{/* 1. Left Section: Album Cover & Track Details */}
			<div className="flex items-center gap-3.5 w-[25%] min-w-[210px] z-10">
				{currentTrack ? (
					<>
						<div
							onClick={onToggleFullscreenLyrics}
							className="relative group cursor-pointer w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/15 shadow-lg shadow-black/40"
							title="点击展开全屏歌词模式"
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
							<div className="flex items-center gap-1.5">
								<p
									onClick={onToggleFullscreenLyrics}
									className="text-xs font-bold truncate hover:text-emerald-400 cursor-pointer text-foreground transition-colors"
									title={currentTrack.title}
								>
									{currentTrack.title}
								</p>
								{badgeInfo && (
									<span
										className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold border shrink-0 leading-tight ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.color}`}
										title={`音频流规格: ${currentQualityId || '默认'}`}
									>
										{badgeInfo.text}
									</span>
								)}
							</div>
							<p className="text-[11px] text-muted-foreground truncate">
								{currentTrack.artist?.name || '未知歌手'}
							</p>
							{currentLine && (
								<p
									onClick={onToggleFullscreenLyrics}
									className="text-[10px] text-emerald-400/90 truncate cursor-pointer hover:underline"
									title={currentLine.content}
								>
									♪ {currentLine.content}
								</p>
							)}
						</div>
					</>
				) : (
					<div className="flex items-center gap-3 text-muted-foreground text-xs">
						<div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shadow-inner">
							<Disc3 className="w-5 h-5 text-muted-foreground/60 animate-[spin_20s_linear_infinite]" />
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

			{/* 2. Center Section: Playback Controls (Row 1) + Gradient Capsule Seek Bar (Row 2) */}
			<div className="flex flex-col items-center justify-center flex-1 max-w-xl mx-auto px-4 z-10">
				{/* Top Controls Cluster - Exactly matching the screenshot */}
				<div className="flex items-center justify-center gap-4 sm:gap-5 pb-1">
					{/* Icon 1: Audio Chain / Status indicator with purple dot */}
					<div
						className="relative p-1.5 text-muted-foreground/75 hover:text-foreground transition-colors cursor-pointer"
						title="B 站流媒体本地缓存代理运行中"
					>
						<Radio className="w-4 h-4" />
						<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400 shadow-[0_0_6px_#a78bfa]" />
					</div>

					{/* Icon 2: Favorite Heart */}
					<button
						onClick={toggleLike}
						title={isLiked ? '已收藏到我喜欢的音乐' : '添加至我喜欢的音乐'}
						className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
					>
						<Heart
							className={`w-4 h-4 transition-all ${
								isLiked
									? 'text-rose-500 fill-rose-500 scale-110 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
									: 'text-muted-foreground hover:text-rose-400'
							}`}
						/>
					</button>

					{/* Icon 3: Playlist Queue Drawer Toggle */}
					<button
						onClick={() => setQueueOpen(!queueOpen)}
						title={`播放队列 (${queue.length} 首)`}
						className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
							queueOpen
								? 'text-emerald-400 bg-emerald-500/15'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						<ListMusic className="w-4 h-4" />
					</button>

					{/* Icon 4: Shuffle */}
					<button
						onClick={toggleShuffle}
						title={`随机播放: ${playMode === 'shuffle' ? '已开启' : '关闭'}`}
						className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
							playMode === 'shuffle'
								? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						<Shuffle className="w-4 h-4" />
					</button>

					{/* Icon 5: Previous Track */}
					<button
						onClick={prev}
						title="上一曲"
						className="p-1.5 rounded-full hover:bg-white/10 text-foreground/85 hover:text-white transition-all active:scale-90"
					>
						<SkipBack className="w-4 h-4 fill-current" />
					</button>

					{/* Icon 6: Hero Play / Pause Button - Distinctive Circular Green Hero */}
					<button
						onClick={togglePlayPause}
						title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
						className="w-10 h-10 rounded-full flex items-center justify-center bg-[#2D7A5E] hover:bg-[#348E6D] text-white shadow-lg shadow-[#2D7A5E]/40 hover:scale-105 active:scale-95 transition-all duration-200"
					>
						{isPlaying ? (
							<Pause className="w-4 h-4 fill-white" />
						) : (
							<Play className="w-4 h-4 fill-white ml-0.5" />
						)}
					</button>

					{/* Icon 7: Next Track */}
					<button
						onClick={next}
						title="下一曲"
						className="p-1.5 rounded-full hover:bg-white/10 text-foreground/85 hover:text-white transition-all active:scale-90"
					>
						<SkipForward className="w-4 h-4 fill-current" />
					</button>

					{/* Icon 8: Repeat / Loop Mode */}
					<button
						onClick={toggleLoopMode}
						title={`循环模式: ${
							playMode === 'repeat_one'
								? '单曲循环'
								: playMode === 'repeat_all'
									? '列表循环'
									: '顺序播放'
						}`}
						className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
							playMode === 'repeat_one' || playMode === 'repeat_all'
								? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						{playMode === 'repeat_one' ? (
							<Repeat1 className="w-4 h-4" />
						) : (
							<Repeat className="w-4 h-4" />
						)}
					</button>

					{/* Icon 9: Microphone (Lyrics Manager) */}
					<button
						onClick={() => setLyricModalOpen(true)}
						title="歌词管理与微调"
						className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
					>
						<Mic className="w-4 h-4" />
					</button>

					{/* Icon 10: Clapperboard (Original B站 Video MV) */}
					<button
						onClick={handleOpenSourceVideo}
						title="前往 B 站查看原视频 / MV"
						className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
					>
						<Clapperboard className="w-4 h-4" />
					</button>
				</div>

				{/* Bottom: Gradient Capsule Progress Bar with timestamps */}
				<div className="w-full flex items-center gap-3">
					<span className="text-[11px] font-mono font-bold text-foreground/80 min-w-[34px] text-right">
						{formatTime(currentTime)}
					</span>

					{/* Gradient Track */}
					<div
						ref={progressBarRef}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						onPointerLeave={() => setHoverProgress(null)}
						className="relative flex-1 h-[5px] hover:h-[7px] transition-all duration-200 rounded-full bg-white/10 hover:bg-white/15 cursor-pointer flex items-center group/seek"
					>
						{/* Hover Time Tooltip Bubble */}
						{hoverProgress !== null && duration > 0 && (
							<div
								className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#0d1322]/95 border border-white/20 text-[10px] font-mono font-bold text-white shadow-xl pointer-events-none z-30 flex items-center gap-1 backdrop-blur-md"
								style={{
									left: `${Math.max(2, Math.min(98, hoverProgress * 100))}%`,
								}}
							>
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
								{formatTime(hoverProgress * duration)}
							</div>
						)}

						{/* Played Multi-stop Gradient Fill */}
						<div
							className="h-full rounded-full transition-all duration-75 relative"
							style={{
								width: `${Math.max(0, Math.min(100, effectiveProgress * 100))}%`,
								background:
									'linear-gradient(to right, #2D7A5E, #5a7b6b 35%, #994d62 70%, #b8435f 100%)',
							}}
						>
							{/* Sleek Scrubber Thumb */}
							<div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-md shadow-black/50 border border-white/30 opacity-0 group-hover/seek:opacity-100 scale-0 group-hover/seek:scale-100 transition-all pointer-events-none" />
						</div>
					</div>

					<span className="text-[11px] font-mono font-bold text-foreground/80 min-w-[34px] text-left">
						{formatTime(duration)}
					</span>
				</div>
			</div>

			{/* 3. Right Section: Loudness Balance, Desktop Lyrics & Volume */}
			<div className="flex items-center justify-end gap-3 w-[25%] min-w-[210px] z-10">
				{/* EBU R128 Loudness Normalization */}
				<button
					onClick={toggleLoudnessNormalization}
					title={
						loudnessEnabled
							? 'EBU R128 音频响度平衡：已开启'
							: 'EBU R128 音频响度平衡：已关闭'
					}
					className={`p-1.5 rounded-xl border border-white/[0.06] transition-colors ${
						loudnessEnabled
							? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
							: 'bg-white/[0.03] text-muted-foreground hover:text-foreground'
					}`}
				>
					<Sliders className="w-3.5 h-3.5" />
				</button>

				{/* Desktop Floating Lyrics Window Toggle - Matching screenshot icon */}
				<button
					onClick={handleToggleDesktopLyrics}
					title="切换桌面悬浮歌词小窗 (Ctrl+Alt+D)"
					className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/15 border border-white/[0.06] hover:border-emerald-500/30 text-muted-foreground hover:text-emerald-400 transition-all"
				>
					<Monitor className="w-4 h-4" />
				</button>

				{/* Volume Control with Hover Slideout Pill */}
				<div className="flex items-center gap-2 group/vol">
					<button
						onClick={toggleMute}
						className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						title={isMuted ? '取消静音' : '静音'}
					>
						{isMuted || volume === 0 ? (
							<VolumeX className="w-4 h-4 text-rose-400" />
						) : (
							<Volume2 className="w-4 h-4" />
						)}
					</button>

					<div className="relative w-20 h-5 flex items-center">
						<div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
							<div
								className="h-full bg-gradient-to-r from-emerald-500 to-[#b8435f] rounded-full transition-all"
								style={{ width: `${effectiveVolumePct}%` }}
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
			</div>

			{/* Queue Drawer Popover */}
			{queueOpen && (
				<div
					className="fixed inset-0 z-50 select-none bg-black/40 backdrop-blur-[2px]"
					onClick={() => setQueueOpen(false)}
				>
					<div
						onClick={(e) => e.stopPropagation()}
						className="absolute bottom-24 left-1/2 -translate-x-1/2 w-96 max-h-[380px] rounded-2xl bg-[#0e1424]/95 border border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
					>
						<div className="flex items-center justify-between pb-2 border-b border-white/10">
							<div className="flex items-center gap-2">
								<ListMusic className="w-4 h-4 text-emerald-400" />
								<span className="text-xs font-bold text-foreground">
									播放队列 ({queue.length})
								</span>
							</div>
							<div className="flex items-center gap-1.5">
								{queue.length > 0 && (
									<button
										onClick={clearQueue}
										title="清空当前队列"
										className="p-1 rounded-md text-muted-foreground hover:text-rose-400 transition-colors"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								)}
								<button
									onClick={() => setQueueOpen(false)}
									className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto no-scrollbar space-y-1 max-h-72">
							{queue.length === 0 ? (
								<div className="py-8 text-center text-xs text-muted-foreground">
									播放队列为空
								</div>
							) : (
								queue.map((track, i) => {
									const isCurrent =
										track.uniqueKey === currentTrack?.uniqueKey
									return (
										<div
											key={`${track.uniqueKey}_${i}`}
											onClick={() => {
												setCurrentIndex(i)
												playTrackWithProxy(track)
											}}
											className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
												isCurrent
													? 'bg-emerald-500/15 text-emerald-300 font-semibold'
													: 'text-muted-foreground hover:text-foreground hover:bg-white/5'
											}`}
										>
											<div className="flex items-center gap-2 truncate max-w-[240px]">
												<span className="text-[10px] opacity-40 font-mono w-4">
													{i + 1}
												</span>
												<span className="truncate">{track.title}</span>
											</div>
											<span className="text-[10px] opacity-60 truncate">
												{track.artist?.name || '未知歌手'}
											</span>
										</div>
									)
								})
							)}
						</div>
					</div>
				</div>
			)}

			{/* Lyrics Settings & Fine-tune Drawer Modal */}
			<LyricsSettingsModal
				isOpen={lyricModalOpen}
				onClose={() => setLyricModalOpen(false)}
				track={currentTrack}
				onLyricsUpdated={(spl) => {
					setSplContent(spl)
					if (currentTrack) {
						window.dispatchEvent(
							new CustomEvent('bbplayer:custom-lyric-change', {
								detail: {
									trackKey: currentTrack.uniqueKey,
									splContent: spl,
								},
							}),
						)
					}
				}}
			/>
		</footer>
	)
}