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
		<footer className="h-[88px] w-full flex flex-col justify-between px-5 pt-1 pb-2 select-none bg-[#090d16]/85 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-10px_30px_rgba(0,0,0,0.45)] z-40">
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