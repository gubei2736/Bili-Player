import React, { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { FluidBackground } from './FluidBackground'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import { getStoredLyricOffset } from '../../services/lyricService'
import { parseSpl, type SplLyricData } from '@bbplayer/splash'
import { useSkinStore, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { getQualityBadgeInfo } from '../../audio/audioSettings'

export interface ImmersiveLyricsViewProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
	splContent?: string | null
}

const DEFAULT_SPL_SAMPLE = `[ti:Bili Player]
[ar:洛天依]
[00:00.00]Bili Player 沉浸式全屏歌词模式
[00:04.00]让音乐与视觉在这一刻完美共鸣
[00:08.50]支持 SPL 逐字音节染色与罗马音双语对照
[00:14.00]跟随音轨流动，感受细腻律动
[00:20.00]♪ ♫ ♩ ♬
`

export const ImmersiveLyricsView: React.FC<ImmersiveLyricsViewProps> = ({
	isOpen,
	onClose,
	track,
	splContent,
}) => {
	const [currentTime, setCurrentTime] = useState(() => desktopAudioEngine.getCurrentTime())
	const [lyricOffsetSec, setLyricOffsetSec] = useState(0)
	const lyricsContainerRef = useRef<HTMLDivElement | null>(null)
	const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())
	const haloCanvasRef = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		if (track) {
			setLyricOffsetSec(getStoredLyricOffset(track.uniqueKey))
		} else {
			setLyricOffsetSec(0)
		}
	}, [track?.uniqueKey, isOpen])

	useEffect(() => {
		const handleOffsetChange = (e: any) => {
			if (track && e.detail?.trackKey === track.uniqueKey) {
				setLyricOffsetSec(e.detail.offsetSec ?? getStoredLyricOffset(track.uniqueKey))
			}
		}
		window.addEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		return () => {
			window.removeEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		}
	}, [track?.uniqueKey])

	const biliTrack = track?.source === 'bilibili' ? (track as BilibiliTrack) : null
	const currentQualityId = biliTrack?.bilibiliMetadata?.bilibiliStreamUrl?.quality
	const currentBandwidth = biliTrack?.bilibiliMetadata?.bilibiliStreamUrl?.bandwidth
	const isLocal = track?.source === 'local'
	const badgeInfo = track
		? getQualityBadgeInfo(currentQualityId, isLocal, currentBandwidth)
		: null

	const lyricsData: SplLyricData | null = useMemo(() => {
		if (!splContent) return null
		try {
			return parseSpl(splContent)
		} catch {
			return null
		}
	}, [splContent])

	// Subscribe to audio engine timeupdate, 60fps RAF loop & Escape key to close
	useEffect(() => {
		if (!isOpen) return
		setCurrentTime(desktopAudioEngine.getCurrentTime())
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			if (event.type === 'timeupdate') {
				setCurrentTime(event.currentTime)
			}
		})

		let animId: number
		const updateLoop = () => {
			if (desktopAudioEngine.isPlaying()) {
				setCurrentTime(desktopAudioEngine.getCurrentTime())
			}
			animId = requestAnimationFrame(updateLoop)
		}
		animId = requestAnimationFrame(updateLoop)

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			unsubscribe()
			if (animId) cancelAnimationFrame(animId)
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen, onClose])

	const currentTimeMs = Math.max(0, (currentTime + lyricOffsetSec) * 1000)

	// Find active line index
	const activeIndex = useMemo(() => {
		if (!lyricsData || !lyricsData.lines || lyricsData.lines.length === 0) return 0
		const lines = lyricsData.lines
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!
			if (currentTimeMs >= line.startTime && currentTimeMs < line.endTime) {
				return i
			}
		}
		for (let i = lines.length - 1; i >= 0; i--) {
			if (currentTimeMs >= lines[i]!.startTime) {
				return i
			}
		}
		return 0
	}, [lyricsData, currentTimeMs])

	// Auto scroll to active line
	useEffect(() => {
		if (!isOpen) return
		const el = lineRefs.current.get(activeIndex)
		if (el && lyricsContainerRef.current) {
			el.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
			})
		}
	}, [activeIndex, isOpen])

	// Audio Halo Visualizer on Left Cover
	useEffect(() => {
		if (!isOpen) return
		const canvas = haloCanvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		let animId: number
		const freqBuffer = new Uint8Array(128)

		const renderHalo = () => {
			desktopAudioEngine.getFrequencyData(freqBuffer)
			let sum = 0
			for (let i = 0; i < 32; i++) {
				sum += freqBuffer[i]!
			}
			const avgEnergy = sum / 32 / 255 // 0.0 to 1.0

			const w = (canvas.width = canvas.offsetWidth)
			const h = (canvas.height = canvas.offsetHeight)
			ctx.clearRect(0, 0, w, h)

			const cx = w / 2
			const cy = h / 2
			const baseR = Math.min(w, h) * 0.42
			const pulseR = baseR + avgEnergy * 28

			const grad = ctx.createRadialGradient(cx, cy, baseR * 0.8, cx, cy, pulseR)
			grad.addColorStop(0, 'rgba(0, 174, 236, 0.4)')
			grad.addColorStop(0.5, 'rgba(255, 46, 147, 0.3)')
			grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

			ctx.fillStyle = grad
			ctx.beginPath()
			ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
			ctx.fill()

			animId = requestAnimationFrame(renderHalo)
		}

		animId = requestAnimationFrame(renderHalo)
		return () => cancelAnimationFrame(animId)
	}, [isOpen])

	const customBgUrl = useSkinStore((s) => s.customBgUrl)
	const customBgOpacity = useSkinStore((s) => s.customBgOpacity)
	const customBgBlur = useSkinStore((s) => s.customBgBlur)

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0, y: '100%' }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: '100%' }}
					transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
					className="fixed inset-0 z-50 overflow-hidden flex flex-col bg-[#07090e] text-foreground select-none"
				>
					{/* Background Layer: Custom Wallpaper or Fluid ambient canvas */}
					{customBgUrl ? (
						<div
							className="absolute inset-0 pointer-events-none z-0 bg-cover bg-center transition-all duration-700"
							style={{
								backgroundImage: `url(${customBgUrl})`,
								opacity: customBgOpacity ?? 0.5,
								filter: customBgBlur ? `blur(${customBgBlur}px)` : 'none',
							}}
						>
							{/* Gentle transparent gradient to keep lyrics legible while keeping custom wallpaper crystal clear */}
							<div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/15" />
						</div>
					) : (
						<FluidBackground coverUrl={track?.coverUrl} />
					)}

					{/* Top bar (Cleaned up: removed '沉浸式 SPL 歌词体验' hint & icon) */}
					<header
						data-tauri-drag-region
						className="relative z-10 h-14 w-full flex items-center justify-end px-6 bg-transparent"
					>
						<button
							onClick={onClose}
							className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shadow-sm"
							title="关闭全屏 (Esc)"
						>
							<X className="w-5 h-5" />
						</button>
					</header>

					{/* Main Stage: Left Cover Halo + Right Dynamic Lyrics */}
					<main className="relative z-10 flex-1 flex items-center justify-center px-8 md:px-16 py-6 overflow-hidden">
						{!track ? (
							/* 处于等候播放歌曲时：界面仅显示四个纯净优雅的音符符号 */
							<div className="flex items-center justify-center gap-8 sm:gap-14 text-white/40 select-none">
								<span className="text-4xl sm:text-5xl font-serif drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
									♪
								</span>
								<span className="text-4xl sm:text-5xl font-serif drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
									♫
								</span>
								<span className="text-4xl sm:text-5xl font-serif drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
									♩
								</span>
								<span className="text-4xl sm:text-5xl font-serif drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
									♬
								</span>
							</div>
						) : (
							<div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-12">
								{/* Left: Album Cover & Audio Halo */}
								<div className="w-full md:w-5/12 flex flex-col items-center justify-center relative">
							<div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
								<canvas
									ref={haloCanvasRef}
									className="absolute inset-0 w-full h-full pointer-events-none scale-125"
								/>
								<div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/15 z-10 bg-black/40">
									<img
										src={
											track?.coverUrl ||
											'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
										}
										alt={track?.title || 'Bili Player'}
										referrerPolicy="no-referrer"
										className="w-full h-full object-cover"
									/>
								</div>
							</div>

							{/* Track info summary */}
							<div className="mt-6 text-center space-y-1.5 z-10 max-w-sm px-4">
								<h1
									className="text-lg md:text-xl font-bold tracking-tight text-white drop-shadow truncate"
									title={
										biliTrack?.bilibiliMetadata?.isMultiPage && (biliTrack.bilibiliMetadata.pagePart || biliTrack.bilibiliMetadata.pageIndex)
											? `${biliTrack.bilibiliMetadata.mainTrackTitle || track?.title} · [P${biliTrack.bilibiliMetadata.pageIndex || 1}] ${biliTrack.bilibiliMetadata.pagePart || track?.title}`
											: track?.title
									}
								>
									{biliTrack?.bilibiliMetadata?.isMultiPage && (biliTrack.bilibiliMetadata.pagePart || biliTrack.bilibiliMetadata.pageIndex)
										? `[P${biliTrack.bilibiliMetadata.pageIndex || 1}] ${biliTrack.bilibiliMetadata.pagePart || track?.title}`
										: (track?.title || '未在播放歌曲')}
								</h1>
								{biliTrack?.bilibiliMetadata?.isMultiPage && biliTrack?.bilibiliMetadata?.mainTrackTitle && (
									<p className="text-xs text-white/50 truncate" title={biliTrack.bilibiliMetadata.mainTrackTitle}>
										{biliTrack.bilibiliMetadata.mainTrackTitle}
									</p>
								)}
								<p className="text-xs md:text-sm text-white/70 font-medium truncate">
									{track?.artist?.name || '未知歌手'}
								</p>
								{badgeInfo && (
									<div className="pt-1 flex items-center justify-center">
										<span
											className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-medium border shadow-sm ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.color}`}
											title={badgeInfo.tooltip}
										>
											{badgeInfo.text}
										</span>
									</div>
								)}
							</div>
						</div>

						{/* Right: Dynamic Syllable Lyrics Stream */}
						<div
							ref={lyricsContainerRef}
							className="w-full md:w-7/12 h-full overflow-y-auto no-scrollbar py-28 space-y-8 text-left scroll-smooth"
						>
							{!lyricsData || lyricsData.lines.length === 0 ? (
								<div className="h-full flex flex-col items-center justify-center text-white/40 space-y-4">
									<div className="flex items-center gap-4 text-3xl font-serif">
										<span className="animate-pulse">♪</span>
										<span className="animate-pulse delay-150">♫</span>
										<span className="animate-pulse delay-300">♬</span>
									</div>
									<p className="text-sm font-medium tracking-wider text-white/50">
										{splContent === '' ? '正在匹配歌词...' : '暂无歌词或纯音乐'}
									</p>
								</div>
							) : (
								lyricsData.lines.map((line, idx) => {
									const isActive = idx === activeIndex
									const distance = Math.abs(idx - activeIndex)
									// 彻底去除高斯模糊 (blur)，仅使用清晰的明度与透明度阶梯保持主次分明与清晰易读
									const opacity =
										distance === 0 ? 1 : distance === 1 ? 0.75 : distance === 2 ? 0.55 : 0.35

									return (
										<div
											key={idx}
											onClick={() => {
												desktopAudioEngine.seek(
													Math.max(0, line.startTime / 1000 - lyricOffsetSec),
												)
											}}
											ref={(el) => {
												if (el) lineRefs.current.set(idx, el)
												else lineRefs.current.delete(idx)
											}}
											className="transition-all duration-300 transform origin-left cursor-pointer hover:opacity-100"
											style={{
												filter: 'none',
												opacity,
												scale: isActive ? 1.05 : 1.0,
											}}
										>
											{/* Main line with syllable highlight */}
											<p className="text-xl md:text-2xl font-bold tracking-wide leading-relaxed">
												{line.isDynamic && line.spans && line.spans.length > 0 ? (
													line.spans.map((span, sIdx) => {
														let fillPct = 0
														if (currentTimeMs >= span.endTime) {
															fillPct = 100
														} else if (currentTimeMs > span.startTime) {
															fillPct = Math.min(
																100,
																((currentTimeMs - span.startTime) /
																	(span.duration || 1)) *
																	100,
															)
														}

														return (
															<span
																key={sIdx}
																className="inline-block transition-all duration-75"
																style={{
																	background: `linear-gradient(to right, #00AEEC ${fillPct}%, rgba(255, 255, 255, 0.5) ${fillPct}%)`,
																	WebkitBackgroundClip: 'text',
																	WebkitTextFillColor: 'transparent',
																}}
															>
																{span.text}
															</span>
														)
													})
												) : (
													<span
														className={
															isActive
																? 'text-primary drop-shadow-[0_2px_12px_rgba(0,174,236,0.6)]'
																: 'text-white/60'
														}
													>
														{line.content}
													</span>
												)}
											</p>

											{/* Romaji syllable translation */}
											{line.romaji && (
												<p className="text-xs text-white/50 font-mono mt-1">
													{line.romaji}
												</p>
											)}

											{/* Bilingual translated line */}
											{line.translation && (
												<p className="text-sm text-sky-200/75 mt-1 font-medium">
													{line.translation}
												</p>
											)}
										</div>
									)
								})
							)}
						</div>
							</div>
						)}
					</main>
				</motion.div>
			)}
		</AnimatePresence>
	)
}