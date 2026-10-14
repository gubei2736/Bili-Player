import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { useQueueStore, useSkinStore, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import { getQualityBadgeInfo } from '../../audio/audioSettings'
import { WavySlider } from '../player/WavySlider'

export interface BottomPlayerBarProps {
	onToggleFullscreenLyrics?: () => void
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
	onToggleFullscreenLyrics,
}) => {
	const {
		queue,
		currentIndex,
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
	const [loudnessEnabled, setLoudnessEnabled] = useState(true)

	const currentTrack = getCurrentTrack()
	const biliTrack =
		currentTrack?.source === 'bilibili' ? (currentTrack as BilibiliTrack) : null
	const currentQualityId = biliTrack?.bilibiliMetadata?.bilibiliStreamUrl?.quality
	const badgeInfo = currentTrack ? getQualityBadgeInfo(currentQualityId) : null

	useEffect(() => {
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			if (event.type === 'play') setIsPlaying(true)
			if (event.type === 'pause') setIsPlaying(false)
			if (event.type === 'timeupdate') {
				setCurrentTime(event.currentTime)
				setDuration(event.duration || 0)
			}
			if (event.type === 'ended') {
				const nextTrack = next()
				if (!nextTrack) {
					setIsPlaying(false)
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

	return (
		<footer className="h-20 w-full flex flex-col justify-between px-4 py-2 select-none bg-background/60 backdrop-blur-2xl border-t border-white/5 z-40">
			{/* Top: Wavy Progress Bar */}
			<div className="w-full -mt-1 px-2">
				<WavySlider
					value={progress}
					duration={duration}
					isPlaying={isPlaying}
					onChange={handleSeek}
					primaryColor={primaryColor}
				/>
			</div>

			{/* Bottom: 3-column control bar */}
			<div className="w-full flex items-center justify-between">
				{/* Left: Track Information */}
				<div className="flex items-center gap-3 w-1/4 min-w-[200px]">
					{currentTrack ? (
						<>
							<div
								onClick={onToggleFullscreenLyrics}
								className="relative group cursor-pointer w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 shadow-sm"
							>
								<img
									src={
										currentTrack.coverUrl ||
										'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
									}
									alt={currentTrack.title}
									referrerPolicy="no-referrer"
									className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
								/>
								<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
									<Maximize2 className="w-4 h-4 text-white" />
								</div>
							</div>
							<div className="overflow-hidden">
								<p
									onClick={onToggleFullscreenLyrics}
									className="text-xs font-semibold truncate hover:underline cursor-pointer text-foreground"
								>
									{currentTrack.title}
								</p>
								<div className="flex items-center gap-1.5 mt-0.5">
									<p className="text-[11px] text-muted-foreground truncate max-w-[130px]">
										{currentTrack.artist?.name || '未知歌手'}
									</p>
									{badgeInfo && (
										<span
											className={`text-[9px] px-1 py-0.2 rounded font-medium border leading-tight ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.color}`}
											title={`当前音频流质量 ID: ${currentQualityId || '默认'}`}
										>
											{badgeInfo.text}
										</span>
									)}
								</div>
							</div>
						</>
					) : (
						<div className="flex items-center gap-2.5 text-muted-foreground text-xs">
							<div className="w-11 h-11 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
								🎵
							</div>
							<span>未在播放歌曲</span>
						</div>
					)}
				</div>

				{/* Center: Playback Controls */}
				<div className="flex items-center gap-4">
					<button
						onClick={togglePlayMode}
						title={`播放模式: ${playMode}`}
						className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
					>
						{playMode === 'shuffle' && <Shuffle className="w-4 h-4 text-primary" />}
						{playMode === 'repeat_one' && <Repeat1 className="w-4 h-4 text-primary" />}
						{playMode === 'repeat_all' && <Repeat className="w-4 h-4 text-primary" />}
						{playMode === 'sequential' && <Repeat className="w-4 h-4" />}
					</button>

					<button
						onClick={prev}
						title="上一曲"
						className="p-2 rounded-full hover:bg-white/10 text-foreground transition-colors"
					>
						<SkipBack className="w-5 h-5 fill-current" />
					</button>

					<button
						onClick={togglePlayPause}
						title={isPlaying ? '暂停' : '播放'}
						className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md"
						style={{ backgroundColor: primaryColor }}
					>
						{isPlaying ? (
							<Pause className="w-5 h-5 fill-current" />
						) : (
							<Play className="w-5 h-5 fill-current ml-0.5" />
						)}
					</button>

					<button
						onClick={next}
						title="下一曲"
						className="p-2 rounded-full hover:bg-white/10 text-foreground transition-colors"
					>
						<SkipForward className="w-5 h-5 fill-current" />
					</button>

					<button
						onClick={toggleLoudnessNormalization}
						title={loudnessEnabled ? '已开启响度均衡' : '已关闭响度均衡'}
						className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
							loudnessEnabled ? 'text-primary' : 'text-muted-foreground'
						}`}
					>
						<Sliders className="w-4 h-4" />
					</button>
				</div>

				{/* Right: Volume & Lyric Trigger */}
				<div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
					<div className="flex items-center gap-2">
						<button
							onClick={toggleMute}
							className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						>
							{isMuted || volume === 0 ? (
								<VolumeX className="w-4 h-4" />
							) : (
								<Volume2 className="w-4 h-4" />
							)}
						</button>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={isMuted ? 0 : volume}
							onChange={handleVolumeChange}
							className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>

					<button
						onClick={onToggleFullscreenLyrics}
						title="全屏歌词模式"
						className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
					>
						<Maximize2 className="w-4 h-4" />
					</button>
				</div>
			</div>
		</footer>
	)
}
