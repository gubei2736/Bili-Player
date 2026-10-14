import React, { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Volume2, Sparkles, Music } from 'lucide-react'
import { FluidBackground } from './FluidBackground'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import { parseSpl, type LyricLine, type SplLyricData } from '@bbplayer/splash'
import type { Track } from '@bbplayer/shared-core'

export interface ImmersiveLyricsViewProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
	splContent?: string | null
}

const DEFAULT_SPL_SAMPLE = `[ti:BBPlayer]
[ar:洛天依]
[00:00.00]BBPlayer 沉浸式全屏歌词模式
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
	const [currentTime, setCurrentTime] = useState(0)
	const lyricsContainerRef = useRef<HTMLDivElement | null>(null)
	const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())
	const haloCanvasRef = useRef<HTMLCanvasElement | null>(null)

	const lyricsData: SplLyricData = useMemo(() => {
		try {
			return parseSpl(splContent || DEFAULT_SPL_SAMPLE)
		} catch {
			return parseSpl(DEFAULT_SPL_SAMPLE)
		}
	}, [splContent])

	// Subscribe to audio engine timeupdate
	useEffect(() => {
		if (!isOpen) return
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			if (event.type === 'timeupdate') {
				setCurrentTime(event.currentTime)
			}
		})
		return unsubscribe
	}, [isOpen])

	const currentTimeMs = currentTime * 1000

	// Find active line index
	const activeIndex = useMemo(() => {
		const lines = lyricsData.lines
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!
			if (currentTimeMs >= line.startTime && currentTimeMs < line.endTime) {
				return i
			}
		}
		// If between lines, find last passed line
		for (let i = lines.length - 1; i >= 0; i--) {
			if (currentTimeMs >= lines[i]!.startTime) {
				return i
			}
		}
		return 0
	}, [lyricsData.lines, currentTimeMs])

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

	if (!isOpen) return null

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, y: '100%' }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: '100%' }}
				transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
				className="fixed inset-0 z-50 overflow-hidden flex flex-col bg-background text-foreground select-none"
			>
				{/* Fluid ambient canvas background */}
				<FluidBackground coverUrl={track?.coverUrl} />

				{/* Top bar */}
				<header
					data-tauri-drag-region
					className="relative z-10 h-14 w-full flex items-center justify-between px-6 bg-black/20 backdrop-blur-md border-b border-white/5"
				>
					<div className="flex items-center gap-2">
						<div className="w-5 h-5 rounded-md bg-gradient-to-tr from-pink-500 to-sky-400 flex items-center justify-center text-white font-bold text-[10px]">
							BB
						</div>
						<span className="text-xs font-semibold text-white/80">
							沉浸式 SPL 歌词体验
						</span>
					</div>

					<button
						onClick={onClose}
						className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
						title="关闭全屏 (Esc)"
					>
						<X className="w-5 h-5" />
					</button>
				</header>

				{/* Main Stage: Left Cover Halo + Right Dynamic Lyrics */}
				<main className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-between px-8 md:px-16 py-6 overflow-hidden gap-12">
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
									alt={track?.title || 'BBPlayer'}
									className="w-full h-full object-cover"
								/>
							</div>
						</div>

						{/* Track info summary */}
						<div className="mt-6 text-center space-y-1 z-10">
							<h1 className="text-lg md:text-xl font-bold tracking-tight text-white drop-shadow">
								{track?.title || '未在播放歌曲'}
							</h1>
							<p className="text-xs md:text-sm text-white/70 font-medium">
								{track?.artist?.name || '未知歌手'}
							</p>
						</div>
					</div>

					{/* Right: Dynamic Syllable Lyrics Stream */}
					<div
						ref={lyricsContainerRef}
						className="w-full md:w-7/12 h-full overflow-y-auto no-scrollbar py-28 space-y-8 text-left scroll-smooth"
					>
						{lyricsData.lines.map((line, idx) => {
							const isActive = idx === activeIndex
							const distance = Math.abs(idx - activeIndex)
							const blurAmount = distance === 0 ? 0 : distance === 1 ? 1.5 : 3
							const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : 0.25

							return (
								<div
									key={idx}
									ref={(el) => {
										if (el) lineRefs.current.set(idx, el)
										else lineRefs.current.delete(idx)
									}}
									className="transition-all duration-300 transform origin-left"
									style={{
										filter: `blur(${blurAmount}px)`,
										opacity,
										scale: isActive ? 1.04 : 1.0,
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
						})}
					</div>
				</main>
			</motion.div>
		</AnimatePresence>
	)
}
