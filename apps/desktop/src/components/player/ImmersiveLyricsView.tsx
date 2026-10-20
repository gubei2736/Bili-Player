import React, { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Maximize2, Minimize2, FileText, Volume2, VolumeX } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { FluidBackground } from './FluidBackground'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import {
	getStoredLyricOffset,
	getAutoMatchLyricsEnabled,
	getLyricFontSizes,
	getLyricsHighlightColor,
	getLyricColors,
	type LyricFontSizes,
	type LyricColors,
} from '../../services/lyricService'
import { parseSpl, type SplLyricData } from '@bbplayer/splash'
import { useSkinStore, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { getQualityBadgeInfo } from '../../audio/audioSettings'
import { LyricsSettingsModal } from '../modals/LyricsSettingsModal'

export interface ImmersiveLyricsViewProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
	splContent?: string | null
	isMatching?: boolean
	onLyricsUpdated?: (splContent: string) => void
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
	isMatching = false,
	onLyricsUpdated,
}) => {
	const customBgUrl = useSkinStore((s) => s.customBgUrl)
	const customBgType = useSkinStore((s) => s.customBgType)
	const customBgOpacity = useSkinStore((s) => s.customBgOpacity)
	const customBgBlur = useSkinStore((s) => s.customBgBlur)
	const themeColors = useSkinStore((s) => s.themeColors)
	const primaryColor = themeColors?.color || '#00AEEC'

	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [currentTime, setCurrentTime] = useState(() => desktopAudioEngine.getCurrentTime())
	const [duration, setDuration] = useState(() => desktopAudioEngine.getDuration() || track?.duration || 0)
	const [lyricOffsetSec, setLyricOffsetSec] = useState(0)
	const [autoMatchEnabled, setAutoMatchEnabled] = useState(() => getAutoMatchLyricsEnabled())
	const [fontSizes, setFontSizes] = useState<LyricFontSizes>(() => getLyricFontSizes())
	const [lyricColors, setLyricColors] = useState<LyricColors>(() => getLyricColors())
	const lyricsContainerRef = useRef<HTMLDivElement | null>(null)
	const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())
	const haloCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const [isWindowFullscreen, setIsWindowFullscreen] = useState(false)
	const immersiveVideoRef = useRef<HTMLVideoElement | null>(null)

	// Volume states & refs
	const [volume, setVolume] = useState(() => desktopAudioEngine.getVolume())
	const [isMuted, setIsMuted] = useState(false)
	const [prevVolume, setPrevVolume] = useState(() => desktopAudioEngine.getVolume() || 0.5)
	const [isDraggingVolume, setIsDraggingVolume] = useState(false)
	const volumeBarRef = useRef<HTMLDivElement | null>(null)

	// Progress states & refs
	const [isDraggingProgress, setIsDraggingProgress] = useState(false)
	const [dragProgress, setDragProgress] = useState(0)
	const [hoverProgress, setHoverProgress] = useState<number | null>(null)
	const progressBarRef = useRef<HTMLDivElement | null>(null)
	const progressBarFillRef = useRef<HTMLDivElement | null>(null)
	const progressThumbRef = useRef<HTMLDivElement | null>(null)
	const timeTextSpanRef = useRef<HTMLSpanElement | null>(null)
	const isDraggingProgressRef = useRef(false)
	isDraggingProgressRef.current = isDraggingProgress
	const seekLockUntilRef = useRef<number>(0)

	// 监听歌词字体色彩变更
	useEffect(() => {
		const handleColorsChange = (e: any) => {
			if (e.detail) {
				setLyricColors(e.detail)
			}
		}
		const handleColorChange = (e: Event) => {
			const customEvt = e as CustomEvent<{ color: string }>
			if (customEvt.detail?.color) {
				setLyricColors(getLyricColors())
			}
		}
		window.addEventListener('bbplayer:lyric-colors-change', handleColorsChange)
		window.addEventListener('bbplayer:lyrics-highlight-color-change', handleColorChange)
		window.addEventListener('bbplayer:desktop-lyrics-color-change', handleColorChange)
		return () => {
			window.removeEventListener('bbplayer:lyric-colors-change', handleColorsChange)
			window.removeEventListener('bbplayer:lyrics-highlight-color-change', handleColorChange)
			window.removeEventListener('bbplayer:desktop-lyrics-color-change', handleColorChange)
		}
	}, [])

	// 检查并同步当前应用窗口是否处于全屏状态
	useEffect(() => {
		let unmounted = false
		const checkFs = async () => {
			try {
				const fs = await invoke<boolean>('is_main_window_fullscreen')
				if (!unmounted) setIsWindowFullscreen(fs)
			} catch {
				try {
					const { getCurrentWindow } = await import('@tauri-apps/api/window')
					const fs = await getCurrentWindow().isFullscreen()
					if (!unmounted) setIsWindowFullscreen(fs)
				} catch {}
			}
		}
		if (isOpen) {
			checkFs()
		}
		return () => {
			unmounted = true
		}
	}, [isOpen])

	// 切换操作系统窗口全屏 (F11 或 顶部按钮)
	const toggleWindowFullscreen = async () => {
		try {
			const nextFs = await invoke<boolean>('toggle_main_window_fullscreen')
			setIsWindowFullscreen(nextFs)
		} catch (err) {
			console.warn('Rust toggle fullscreen failed, falling back to window API:', err)
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window')
				const win = getCurrentWindow()
				const current = await win.isFullscreen()
				await win.setFullscreen(!current)
				setIsWindowFullscreen(!current)
			} catch (err2) {
				console.warn('Fallback toggle fullscreen failed:', err2)
			}
		}
	}

	// 关闭沉浸式全屏歌词模式
	const handleClose = async () => {
		try {
			await invoke('set_main_window_fullscreen', { fullscreen: false })
			setIsWindowFullscreen(false)
		} catch {
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window')
				const win = getCurrentWindow()
				if (await win.isFullscreen()) {
					await win.setFullscreen(false)
					setIsWindowFullscreen(false)
				}
			} catch {}
		}
		onClose()
	}

	// 监听键盘按键: F11 切换窗口全屏, Esc 退出
	useEffect(() => {
		if (!isOpen) return
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'F11') {
				e.preventDefault()
				toggleWindowFullscreen()
			} else if (e.key === 'Escape') {
				e.preventDefault()
				handleClose()
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen])

	useEffect(() => {
		const handleFontSizeChange = (e: any) => {
			setFontSizes(e.detail ?? getLyricFontSizes())
		}
		window.addEventListener('bbplayer:lyric-font-size-change', handleFontSizeChange)
		return () => {
			window.removeEventListener('bbplayer:lyric-font-size-change', handleFontSizeChange)
		}
	}, [])

	useEffect(() => {
		const handleAutoMatchChange = (e: any) => {
			setAutoMatchEnabled(e.detail?.enabled ?? getAutoMatchLyricsEnabled())
		}
		window.addEventListener('bbplayer:auto-match-lyrics-change', handleAutoMatchChange)
		return () => {
			window.removeEventListener('bbplayer:auto-match-lyrics-change', handleAutoMatchChange)
		}
	}, [])

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
				if (!isDraggingProgressRef.current && performance.now() > seekLockUntilRef.current) {
					setCurrentTime(event.currentTime)
				}
			}
		})

		let animId: number
		let lastUpdate = 0
		const updateLoop = (now: number) => {
			if (now - lastUpdate >= 16) {
				lastUpdate = now
				if (!isDraggingProgressRef.current && performance.now() > seekLockUntilRef.current) {
					if (desktopAudioEngine.isPlaying()) {
						setCurrentTime(desktopAudioEngine.getCurrentTime())
					}
				}
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

	// 监听歌曲总时长变化
	useEffect(() => {
		setDuration(desktopAudioEngine.getDuration() || track?.duration || 0)
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			if (event.type === 'durationchange' || event.type === 'loadedmetadata') {
				setDuration(desktopAudioEngine.getDuration() || track?.duration || 0)
			}
		})
		return () => {
			unsubscribe()
		}
	}, [track?.uniqueKey])

	// 视频壁纸后台暂停、前台自动恢复
	useEffect(() => {
		const video = immersiveVideoRef.current
		if (!video || customBgType !== 'video' || !isOpen) return

		const handleVisibility = () => {
			if (document.hidden) {
				video.pause()
			} else {
				video.play().catch(() => {})
			}
		}

		const handleBlur = () => {
			video.pause()
		}

		const handleFocus = () => {
			if (!document.hidden) {
				video.play().catch(() => {})
			}
		}

		document.addEventListener('visibilitychange', handleVisibility)
		window.addEventListener('blur', handleBlur)
		window.addEventListener('focus', handleFocus)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibility)
			window.removeEventListener('blur', handleBlur)
			window.removeEventListener('focus', handleFocus)
		}
	}, [isOpen, customBgUrl, customBgType])

	const formatTime = (secs: number) => {
		if (isNaN(secs) || secs < 0) return '0:00'
		const m = Math.floor(secs / 60)
		const s = Math.floor(secs % 60)
		return `${m}:${s < 10 ? '0' : ''}${s}`
	}

	const toggleMute = () => {
		if (isMuted) {
			const target = prevVolume > 0 ? prevVolume : 0.5
			setVolume(target)
			setIsMuted(false)
			desktopAudioEngine.setVolume(target)
		} else {
			setPrevVolume(volume)
			setIsMuted(true)
			desktopAudioEngine.setVolume(0)
		}
	}

	const calcVolumeFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
		const bar = volumeBarRef.current
		if (!bar) return 0
		const rect = bar.getBoundingClientRect()
		const ratio = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
		return Math.round(ratio * 100) / 100
	}

	const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId)
		setIsDraggingVolume(true)
		const v = calcVolumeFromPointer(e)
		setVolume(v)
		if (isMuted) setIsMuted(false)
		desktopAudioEngine.setVolume(v)
		try {
			localStorage.setItem('bbplayer_volume', String(v))
		} catch {}
	}

	const handleVolumePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!isDraggingVolume) return
		const v = calcVolumeFromPointer(e)
		setVolume(v)
		if (isMuted) setIsMuted(false)
		desktopAudioEngine.setVolume(v)
		try {
			localStorage.setItem('bbplayer_volume', String(v))
		} catch {}
	}

	const handleVolumePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (isDraggingVolume) {
			const v = calcVolumeFromPointer(e)
			setVolume(v)
			if (isMuted) setIsMuted(false)
			desktopAudioEngine.setVolume(v)
			try {
				localStorage.setItem('bbplayer_volume', String(v))
			} catch {}
			setIsDraggingVolume(false)
		}
		try {
			e.currentTarget.releasePointerCapture(e.pointerId)
		} catch {}
	}

	const calculateProgressFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
		const bar = progressBarRef.current
		if (!bar) return 0
		const rect = bar.getBoundingClientRect()
		const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
		return rect.width > 0 ? x / rect.width : 0
	}

	const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId)
		setIsDraggingProgress(true)
		seekLockUntilRef.current = performance.now() + 400
		const p = calculateProgressFromPointer(e)
		setDragProgress(p)
		const targetSec = p * duration
		setCurrentTime(targetSec)
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

	const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const p = calculateProgressFromPointer(e)
		setHoverProgress(p)
		if (isDraggingProgress) {
			setDragProgress(p)
			seekLockUntilRef.current = performance.now() + 400
			const targetSec = p * duration
			setCurrentTime(targetSec)
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

	const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (isDraggingProgress) {
			const p = calculateProgressFromPointer(e)
			const targetSec = p * duration
			seekLockUntilRef.current = performance.now() + 400
			setCurrentTime(targetSec)
			setIsDraggingProgress(false)
			if (timeTextSpanRef.current) {
				timeTextSpanRef.current.textContent = formatTime(targetSec)
			}
			if (progressBarFillRef.current) {
				progressBarFillRef.current.style.width = `${p * 100}%`
			}
			if (progressThumbRef.current) {
				progressThumbRef.current.style.left = `${p * 100}%`
			}
			if (duration > 0) {
				desktopAudioEngine.seek(targetSec)
				desktopAudioEngine.play().catch(() => {})
			}
		}
		try {
			e.currentTarget.releasePointerCapture(e.pointerId)
		} catch {}
	}

	const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0
	const effectiveProgress = isDraggingProgress ? dragProgress : progress

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

	// Auto scroll to active line with smooth fluid easing & golden ratio viewport alignment
	useEffect(() => {
		if (!isOpen) return
		const el = lineRefs.current.get(activeIndex)
		const container = lyricsContainerRef.current
		if (el && container) {
			const containerHeight = container.clientHeight
			const elTop = el.offsetTop
			const elHeight = el.clientHeight
			// 黄金视线分割点：歌词主体居中略微偏上（42% 视口高度），带来更具动感的推移感
			const targetScrollTop = Math.max(0, elTop - containerHeight * 0.42 + elHeight * 0.5)
			container.scrollTo({
				top: targetScrollTop,
				behavior: 'smooth',
			})
		}
	}, [activeIndex, isOpen])

	// Audio Halo Visualizer on Left Cover (用户自定义背景壁纸时不生效)
	// ⚡ 性能优化：改用 ResizeObserver 仅在实际缩放时重置显存纹理，杜绝每帧重复分配显存，并支持后台休眠
	useEffect(() => {
		if (!isOpen || Boolean(customBgUrl)) return
		const canvas = haloCanvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		let animId: number
		let lastHalo = 0
		const freqBuffer = new Uint8Array(128)

		let currentW = (canvas.width = canvas.offsetWidth || 300)
		let currentH = (canvas.height = canvas.offsetHeight || 300)

		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect
				if (width > 0 && height > 0) {
					currentW = canvas.width = Math.round(width)
					currentH = canvas.height = Math.round(height)
				}
			}
		})
		ro.observe(canvas)

		const renderHalo = (now: number) => {
			// 后台/最小化休眠
			if (document.hidden) {
				animId = requestAnimationFrame(renderHalo)
				return
			}

			// ⚡ 限制音频光晕为 60FPS，防止高刷屏下过量重绘损耗 GPU
			if (now - lastHalo >= 16) {
				lastHalo = now
				desktopAudioEngine.getFrequencyData(freqBuffer)
				let sum = 0
				for (let i = 0; i < 32; i++) {
					sum += freqBuffer[i]!
				}
				const avgEnergy = sum / 32 / 255 // 0.0 to 1.0

				const w = currentW
				const h = currentH
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
			}

			animId = requestAnimationFrame(renderHalo)
		}

		animId = requestAnimationFrame(renderHalo)
		return () => {
			ro.disconnect()
			cancelAnimationFrame(animId)
		}
	}, [isOpen, customBgUrl])

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
							className="absolute inset-0 pointer-events-none z-0 overflow-hidden transition-all duration-700"
							style={{
								opacity: customBgOpacity ?? 0.5,
								filter: customBgBlur ? `blur(${customBgBlur}px)` : 'none',
							}}
						>
							{customBgType === 'video' ? (
								<video
									ref={immersiveVideoRef}
									src={customBgUrl}
									autoPlay
									loop
									muted
									playsInline
									className="w-full h-full object-cover"
								/>
							) : (
								<div
									className="w-full h-full bg-cover bg-center"
									style={{
										backgroundImage: `url(${customBgUrl})`,
									}}
								/>
							)}
							{/* Gentle transparent gradient to keep lyrics legible while keeping custom wallpaper crystal clear */}
							<div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/15" />
						</div>
					) : (
						<FluidBackground coverUrl={track?.coverUrl} />
					)}

					{/* Top bar */}
					<header
						data-tauri-drag-region
						className="relative z-10 h-14 w-full flex items-center justify-end px-6 bg-transparent gap-2"
					>
						{/* 歌词管理与微调 */}
						<button
							onClick={() => setIsSettingsOpen(true)}
							className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shadow-sm"
							title="歌词管理与微调"
						>
							<FileText className="w-5 h-5" />
						</button>
						<button
							onClick={toggleWindowFullscreen}
							className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shadow-sm"
							title={isWindowFullscreen ? '退出窗口全屏 (F11)' : '窗口全屏 (F11)'}
						>
							{isWindowFullscreen ? (
								<Minimize2 className="w-5 h-5" />
							) : (
								<Maximize2 className="w-5 h-5" />
							)}
						</button>
						<button
							onClick={handleClose}
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
								{!customBgUrl && (
									<canvas
										ref={haloCanvasRef}
										className="absolute inset-0 w-full h-full pointer-events-none scale-125"
									/>
								)}
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
										{isMatching && autoMatchEnabled
											? '正在匹配歌词...'
											: !autoMatchEnabled
											? '歌词自动匹配已关闭 (可手动搜索匹配)'
											: '暂无歌词或纯音乐'}
									</p>
								</div>
							) : (
								lyricsData.lines.map((line, idx) => {
									const isActive = idx === activeIndex
									const distance = Math.abs(idx - activeIndex)
									// 纯净字号缩放聚焦与景深透明度梯队，左侧原位对齐无水平横移与指示条干扰
									const opacity =
										distance === 0 ? 1 : distance === 1 ? 0.72 : distance === 2 ? 0.48 : 0.28
									const scale = isActive ? 1.06 : distance === 1 ? 1.0 : distance === 2 ? 0.97 : 0.95

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
											className="relative transition-all cursor-pointer hover:opacity-100 group/line py-1.5 transform origin-left"
											style={{
												filter: 'none',
												opacity,
												transform: `scale(${scale})`,
												transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
											}}
										>
											{/* Main line with syllable highlight */}
											<p
												className="font-bold tracking-wide leading-relaxed"
												style={{ fontSize: `${fontSizes.main}px` }}
											>
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
																	background: `linear-gradient(to right, ${lyricColors.main} ${fillPct}%, rgba(255, 255, 255, 0.5) ${fillPct}%)`,
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
														style={{ color: isActive ? lyricColors.main : undefined }}
														className={
															isActive
																? 'font-bold'
																: 'text-white/60'
														}
													>
														{line.content}
													</span>
												)}
											</p>

											{/* Romaji syllable translation */}
											{line.romaji && (
												<p
													className="font-mono mt-1 transition-colors"
													style={{
														fontSize: `${fontSizes.roma}px`,
														color: isActive ? lyricColors.roma : undefined,
														opacity: isActive ? 0.85 : 0.5,
													}}
												>
													{line.romaji}
												</p>
											)}

											{/* Bilingual translated line */}
											{line.translation && (
												<p
													className="mt-1 font-medium transition-colors"
													style={{
														fontSize: `${fontSizes.trans}px`,
														color: isActive ? lyricColors.trans : undefined,
														opacity: isActive ? 0.9 : 0.65,
													}}
												>
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

					{/* Right: Vertical Volume Bar (Only visible when mouse hovers over volume area) */}
					<div
						className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 pr-3 pl-8 py-8 transition-opacity duration-300 ${
							isDraggingVolume ? 'opacity-100' : 'opacity-0 hover:opacity-100'
						}`}
					>
						<div className="bg-black/35 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 flex flex-col items-center gap-3 shadow-2xl">
							<span className="text-[10px] font-mono font-bold text-white/70 select-none">
								{Math.round((isMuted ? 0 : volume) * 100)}%
							</span>

							{/* Vertical Slider Track (Double height: h-56) */}
							<div
								ref={volumeBarRef}
								onPointerDown={handleVolumePointerDown}
								onPointerMove={handleVolumePointerMove}
								onPointerUp={handleVolumePointerUp}
								className="relative w-2 h-56 flex flex-col justify-end items-center cursor-pointer group/vtrack py-1"
							>
								<div className="w-1.5 h-full bg-white/15 rounded-full overflow-hidden flex flex-col justify-end backdrop-blur-sm">
									<div
										className="w-full rounded-full transition-all"
										style={{
											height: `${(isMuted ? 0 : volume) * 100}%`,
											backgroundColor: primaryColor,
											opacity: 0.75,
										}}
									/>
								</div>
								{/* Thumb */}
								<div
									className="w-3 h-3 rounded-full bg-white/80 backdrop-blur-sm border border-white/50 pointer-events-none absolute -translate-y-1/2 shadow-md transition-transform group-hover/vtrack:scale-125"
									style={{
										bottom: `calc(${(isMuted ? 0 : volume) * 100}% - 6px)`,
										boxShadow: `0 0 8px ${primaryColor}80, 0 2px 4px rgba(0,0,0,0.3)`,
									}}
								/>
							</div>

							<button
								onClick={toggleMute}
								className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
								title={isMuted ? '取消静音' : '静音'}
							>
								{isMuted || volume === 0 ? (
									<VolumeX className="w-4 h-4 text-rose-400" />
								) : (
									<Volume2 className="w-4 h-4" />
								)}
							</button>
						</div>
					</div>

					{/* Bottom: Straight Linear Progress Bar (Matching main bottom bar scheme, only visible when hovered) */}
					<div
						className={`fixed bottom-0 left-0 right-0 z-40 px-8 sm:px-16 pt-8 pb-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
							isDraggingProgress ? 'opacity-100' : 'opacity-0 hover:opacity-100'
						}`}
					>
						<div className="w-full flex items-center gap-3 h-5">
							{/* Current Time */}
							<span
								ref={timeTextSpanRef}
								className="text-[11px] font-mono font-bold text-white/80 min-w-[36px] text-right select-none"
							>
								{formatTime(isDraggingProgress ? dragProgress * duration : currentTime)}
							</span>

							{/* Progress Track */}
							<div
								ref={progressBarRef}
								onPointerDown={handleProgressPointerDown}
								onPointerMove={handleProgressPointerMove}
								onPointerUp={handleProgressPointerUp}
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
										<span
											className="w-1.5 h-1.5 rounded-full animate-pulse"
											style={{ backgroundColor: primaryColor }}
										/>
										{formatTime(hoverProgress * duration)}
									</div>
								)}

								{/* Background Line */}
								<div className="w-full h-[3px] group-hover/progress:h-[4px] rounded-full bg-white/15 group-hover/progress:bg-white/25 transition-[height,background-color] duration-150 overflow-hidden relative">
									<div
										ref={progressBarFillRef}
										className="h-full rounded-full"
										style={{
											width: `${Math.max(0, Math.min(100, effectiveProgress * 100))}%`,
											backgroundColor: primaryColor,
										}}
									/>
								</div>

								{/* Thumb Circle */}
								<div
									ref={progressThumbRef}
									className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border border-white/80 pointer-events-none transition-[opacity,transform] duration-150 ${
										isDraggingProgress
											? 'opacity-100 scale-125'
											: 'opacity-0 group-hover/progress:opacity-100 group-hover/progress:scale-110'
									}`}
									style={{
										left: `${Math.max(0, Math.min(100, effectiveProgress * 100))}%`,
										boxShadow: `0 0 6px ${primaryColor}, 0 2px 4px rgba(0,0,0,0.5)`,
									}}
								/>
							</div>

							{/* Total Duration */}
							<span className="text-[11px] font-mono font-bold text-white/80 min-w-[36px] text-left select-none">
								{formatTime(duration)}
							</span>
						</div>
					</div>

					{/* 歌词管理与微调弹窗 */}
					<LyricsSettingsModal
						isOpen={isSettingsOpen}
						onClose={() => setIsSettingsOpen(false)}
						track={track}
						onLyricsUpdated={onLyricsUpdated}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	)
}