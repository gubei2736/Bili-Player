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
	Heart,
	ListMusic,
	FileText,
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

	// Linear Progress Bar drag & hover states
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

	// 4. Audio Engine event subscription
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

	const toggleLoopMode = () => {
		if (playMode === 'sequential') setPlayMode('repeat_all')
		else if (playMode === 'repeat_all') setPlayMode('repeat_one')
		else if (playMode === 'repeat_one') setPlayMode('shuffle')
		else setPlayMode('sequential')
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

	// Interactive seek calculations for linear progress bar
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
		<footer className="h-[96px] w-full flex flex-col justify-between px-6 pt-2 pb-3 select-none bg-[#090d16]/95 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-12px_40px_rgba(0,0,0,0.6)] z-40 relative">
			{/* Top: 100% Straight Linear Progress Bar (No wave, pure precision line) */}
			<div className="w-full flex items-center gap-3 h-5 -mt-0.5">
				{/* Current Time */}
				<span className="text-[11px] font-mono font-bold text-muted-foreground/90 min-w-[36px] text-right select-none">
					{formatTime(isDragging ? dragProgress * duration : currentTime)}
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
					{hoverProgress !== null && duration > 0 && (
						<div
							className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#0d1322]/95 border border-white/20 text-[10px] font-mono font-bold text-white shadow-xl pointer-events-none z-30 flex items-center gap-1 backdrop-blur-md"
							style={{
								left: `${Math.max(2, Math.min(98, hoverProgress * 100))}%`,
							}}
						>
							<span className="w-1.5 h-1.5 rounded-full bg-[#00AEEC] animate-pulse" />
							{formatTime(hoverProgress * duration)}
						</div>
					)}

					{/* Background Line */}
					<div className="w-full h-[3px] group-hover/progress:h-[4px] rounded-full bg-white/10 group-hover/progress:bg-white/15 transition-all duration-150 overflow-hidden relative">
						{/* Played Sky-Blue Progress Line */}
						<div
							className="h-full rounded-full transition-all duration-75"
							style={{
								width: `${Math.max(0, Math.min(100, effectiveProgress * 100))}%`,
								backgroundColor: '#00AEEC',
							}}
						/>
					</div>

					{/* Pure White Glowing Handle (No wave distortion, perfectly centered) */}
					<div
						className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_8px_rgba(0,174,236,0.8),0_2px_4px_rgba(0,0,0,0.5)] border border-white/60 pointer-events-none transition-transform duration-100 group-hover/progress:scale-125"
						style={{
							left: `${Math.max(0, Math.min(100, effectiveProgress * 100))}%`,
						}}
					/>
				</div>

				{/* Total Duration */}
				<span className="text-[11px] font-mono font-bold text-muted-foreground/90 min-w-[36px] text-left select-none">
					{formatTime(duration)}
				</span>
			</div>

			{/* Bottom: 3-Column Control Layout with guaranteed non-clipped Play Button */}
			<div className="w-full flex items-center justify-between h-[60px]">
				{/* 1. Left Column: Album Art & Track Info */}
				<div className="flex items-center gap-3.5 w-[28%] min-w-[220px]">
					{currentTrack ? (
						<>
							<div
								onClick={onToggleFullscreenLyrics}
								className="relative group cursor-pointer w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/15 shadow-md shadow-black/40"
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
								<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
									<Maximize2 className="w-4 h-4 text-white drop-shadow" />
								</div>
							</div>

							<div className="overflow-hidden space-y-0.5">
								<p
									onClick={onToggleFullscreenLyrics}
									className="text-xs font-bold truncate hover:text-[#00AEEC] cursor-pointer text-foreground transition-colors"
									title={currentTrack.title}
								>
									{currentTrack.title}
								</p>
								<div className="flex items-center gap-2">
									<p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
										{currentTrack.artist?.name || '未知歌手'}
									</p>
									{badgeInfo && (
										<span
											className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border shrink-0 leading-tight ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.color}`}
											title={`当前音质规格: ${currentQualityId || '默认'}`}
										>
											{badgeInfo.text}
										</span>
									)}
								</div>
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

				{/* 2. Center Column: Scrolling Lyric on top + Non-clipped Circular Play Controls below */}
				<div className="flex flex-col items-center justify-center flex-1 max-w-lg mx-auto">
					{/* Status Bar Lyric (Line 1) */}
					<div
						onClick={onToggleFullscreenLyrics}
						className="h-5 flex items-center justify-center gap-2 cursor-pointer text-center overflow-hidden max-w-md group mb-1"
						title="状态栏歌词 (点击展开全屏歌词)"
					>
						{currentLine ? (
							<div className="flex items-center gap-2 text-xs truncate">
								<span className="font-semibold text-foreground/90 group-hover:text-[#00AEEC] transition-colors truncate">
									{currentLine.content}
								</span>
								{currentLine.translation && (
									<span className="text-[11px] text-muted-foreground/80 hidden sm:inline group-hover:text-sky-300 transition-colors truncate">
										{currentLine.translation}
									</span>
								)}
							</div>
						) : (
							<span className="text-[11px] text-muted-foreground/60 tracking-wider">
								{currentTrack ? '♪ 沉浸聆听中 · 点击查看全屏歌词' : 'BBPlayer 音乐播放器'}
							</span>
						)}
					</div>

					{/* Playback Controls (Line 2) - Roomy, centered, 100% full circle */}
					<div className="flex items-center justify-center gap-4 sm:gap-5">
						{/* Loop Mode */}
						<button
							onClick={toggleLoopMode}
							title={`播放模式: ${
								playMode === 'repeat_one'
									? '单曲循环'
									: playMode === 'repeat_all'
										? '列表循环'
										: playMode === 'shuffle'
											? '随机播放'
											: '顺序播放'
							}`}
							className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
								playMode !== 'sequential'
									? 'text-[#00AEEC] drop-shadow-[0_0_8px_rgba(0,174,236,0.6)]'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							{playMode === 'shuffle' && <Shuffle className="w-4 h-4" />}
							{playMode === 'repeat_one' && <Repeat1 className="w-4 h-4" />}
							{(playMode === 'repeat_all' || playMode === 'sequential') && (
								<Repeat className="w-4 h-4" />
							)}
						</button>

						{/* Previous Track */}
						<button
							onClick={prev}
							title="上一曲"
							className="p-1.5 rounded-full hover:bg-white/10 text-foreground/85 hover:text-white transition-all active:scale-90"
						>
							<SkipBack className="w-5 h-5 fill-current" />
						</button>

						{/* PERFECT CIRCULAR HERO PLAY BUTTON - Guaranteed 100% Full Circle, Never Cut Off */}
						<button
							onClick={togglePlayPause}
							title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
							className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-[#00AEEC] hover:bg-[#1bbefa] active:bg-[#009fd6] text-white shadow-[0_4px_16px_rgba(0,174,236,0.45)] hover:scale-105 active:scale-95 transition-all duration-200"
						>
							{isPlaying ? (
								<Pause className="w-4 h-4 fill-white" />
							) : (
								<Play className="w-4 h-4 fill-white ml-0.5" />
							)}
						</button>

						{/* Next Track */}
						<button
							onClick={next}
							title="下一曲"
							className="p-1.5 rounded-full hover:bg-white/10 text-foreground/85 hover:text-white transition-all active:scale-90"
						>
							<SkipForward className="w-5 h-5 fill-current" />
						</button>

						{/* Equalizer / Loudness Balance */}
						<button
							onClick={toggleLoudnessNormalization}
							title={
								loudnessEnabled
									? 'EBU R128 音频响度平衡：已开启'
									: 'EBU R128 音频响度平衡：已关闭'
							}
							className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
								loudnessEnabled
									? 'text-[#00AEEC] drop-shadow-[0_0_8px_rgba(0,174,236,0.6)]'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<Sliders className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* 3. Right Column: Volume, Lyric Setting, Desktop Lyrics, Fullscreen */}
				<div className="flex items-center justify-end gap-3 w-[28%] min-w-[220px]">
					{/* Favorite Heart */}
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

					{/* Queue Drawer Button */}
					<button
						onClick={() => setQueueOpen(!queueOpen)}
						title={`播放队列 (${queue.length} 首)`}
						className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
							queueOpen
								? 'text-[#00AEEC] bg-[#00AEEC]/15'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						<ListMusic className="w-4 h-4" />
					</button>

					{/* Volume Control */}
					<div className="flex items-center gap-1.5 group/vol">
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
							<div className="w-full h-[3px] bg-white/15 rounded-full overflow-hidden">
								<div
									className="h-full bg-[#00AEEC] rounded-full transition-all"
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
								className="w-2.5 h-2.5 rounded-full bg-[#00AEEC] shadow-sm pointer-events-none transition-transform group-hover/vol:scale-125 absolute -translate-x-1/2"
								style={{
									left: `${effectiveVolumePct}%`,
								}}
							/>
						</div>
					</div>

					{/* Lyrics Fine-tune Drawer Button */}
					<button
						onClick={() => setLyricModalOpen(true)}
						title="歌词微调与智能搜索匹配"
						className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-[#00AEEC] transition-colors"
					>
						<FileText className="w-4 h-4" />
					</button>

					{/* Desktop Floating Lyrics Window Toggle */}
					<button
						onClick={handleToggleDesktopLyrics}
						title="切换桌面悬浮歌词小窗"
						className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-[#00AEEC] transition-colors"
					>
						<Monitor className="w-4 h-4" />
					</button>

					{/* Fullscreen Lyrics Toggle */}
					<button
						onClick={onToggleFullscreenLyrics}
						title="展开全屏歌词模式"
						className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-[#00AEEC] transition-colors"
					>
						<Maximize2 className="w-4 h-4" />
					</button>
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
						className="absolute bottom-28 left-1/2 -translate-x-1/2 w-96 max-h-[380px] rounded-2xl bg-[#0e1424]/95 border border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
					>
						<div className="flex items-center justify-between pb-2 border-b border-white/10">
							<div className="flex items-center gap-2">
								<ListMusic className="w-4 h-4 text-[#00AEEC]" />
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
													? 'bg-[#00AEEC]/15 text-sky-300 font-semibold'
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