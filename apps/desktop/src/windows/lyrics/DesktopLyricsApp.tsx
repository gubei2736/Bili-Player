import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
	Lock,
	X,
	Play,
	Pause,
	SkipBack,
	SkipForward,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { emit, listen } from '@tauri-apps/api/event'
import { parseSpl, type SplLyricData, type LyricLine } from '@bbplayer/splash'
import { getLyricFontSizes, getDesktopLyricsColor } from '../../services/lyricService'

export type LyricsSyncEvent =
	| {
			type: 'TRACK_CHANGE'
			splContent?: string
			durationMs: number
			title: string
			artist: string
	  }
	| {
			type: 'STATE_SYNC'
			isPlaying: boolean
			currentTimeMs: number
			timestamp: number
	  }
	| {
			type: 'STYLE_UPDATE'
			fontSize: number
			primaryColor: string
			lockMouse: boolean
	  }

const FONT_SIZE_STORAGE_KEY = 'bbplayer_desktop_lyrics_fontsize'

export const DesktopLyricsApp: React.FC = () => {
	const [isLocked, setIsLocked] = useState(false)
	const [showLockToast, setShowLockToast] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [displayTimeMs, setDisplayTimeMs] = useState(0)
	const [title, setTitle] = useState('Bili Player 桌面歌词')
	const [artist, setArtist] = useState('沉浸音乐体验')
	const [splContent, setSplContent] = useState<string | null>(null)
	const [fontSize, setFontSize] = useState<number>(() => {
		try {
			const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
			return saved ? Math.max(16, Math.min(40, Number(saved))) : 24
		} catch {
			return 24
		}
	})
	const [primaryColor, setPrimaryColor] = useState<string>(() => getDesktopLyricsColor())

	// 高精度本地时钟插值锚点，彻底消除 200ms IPC 节流带来的逐字卡顿
	const syncAnchorRef = useRef<{
		baseTimeMs: number
		perfNow: number
		isPlaying: boolean
	}>({
		baseTimeMs: 0,
		perfNow: performance.now(),
		isPlaying: false,
	})

	// Parse SPL lyrics when content changes
	const lyricsData: SplLyricData | null = useMemo(() => {
		if (!splContent) return null
		try {
			return parseSpl(splContent)
		} catch {
			return null
		}
	}, [splContent])

	// Auto-dismiss lock toast after 3 seconds
	useEffect(() => {
		if (showLockToast) {
			const timer = setTimeout(() => setShowLockToast(false), 3000)
			return () => clearTimeout(timer)
		}
	}, [showLockToast])

	// IPC Event Listener from Main Window & Global Shortcuts
	useEffect(() => {
		const unlistenSyncPromise = listen<LyricsSyncEvent>(
			'lyrics-sync',
			(event) => {
				const payload = event.payload
				if (payload.type === 'TRACK_CHANGE') {
					setTitle(payload.title)
					setArtist(payload.artist)
					if (payload.splContent !== undefined) {
						setSplContent(payload.splContent || null)
					} else {
						setSplContent(null)
					}
				} else if (payload.type === 'STATE_SYNC') {
					syncAnchorRef.current = {
						baseTimeMs: payload.currentTimeMs,
						perfNow: performance.now(),
						isPlaying: payload.isPlaying,
					}
					setIsPlaying(payload.isPlaying)
					setDisplayTimeMs(payload.currentTimeMs)
				} else if (payload.type === 'STYLE_UPDATE') {
					if (payload.fontSize) setFontSize(payload.fontSize)
					if (payload.primaryColor) setPrimaryColor(payload.primaryColor)
					setIsLocked(payload.lockMouse)
				}
			},
		)

		const unlistenLockPromise = listen<boolean>(
			'lyrics-lock-change',
			(event) => {
				const locked = Boolean(event.payload)
				setIsLocked(locked)
				if (locked) {
					setShowLockToast(true)
				}
			},
		)

		const handleLocalColorChange = (e: any) => {
			if (e.detail?.color) {
				setPrimaryColor(e.detail.color)
			}
		}
		window.addEventListener('bbplayer:desktop-lyrics-color-change', handleLocalColorChange)

		// 窗口挂载时，主动拉取 Rust 端真实的穿透锁定状态，并通知主窗口补发当前歌词状态
		invoke<boolean>('is_lyrics_locked')
			.then((locked) => {
				setIsLocked(Boolean(locked))
			})
			.catch(() => {})

		emit('lyrics-request-initial-sync').catch(() => {})

		return () => {
			unlistenSyncPromise.then((unlisten) => unlisten())
			unlistenLockPromise.then((unlisten) => unlisten())
			window.removeEventListener('bbplayer:desktop-lyrics-color-change', handleLocalColorChange)
		}
	}, [])

	// Determine active line
	const activeLine: LyricLine | null = useMemo(() => {
		if (!lyricsData || lyricsData.lines.length === 0) return null
		for (const line of lyricsData.lines) {
			if (displayTimeMs >= line.startTime && displayTimeMs < line.endTime) {
				return line
			}
		}
		for (let i = lyricsData.lines.length - 1; i >= 0; i--) {
			if (displayTimeMs >= lyricsData.lines[i]!.startTime) {
				return lyricsData.lines[i]!
			}
		}
		return lyricsData.lines[0] || null
	}, [lyricsData, displayTimeMs])

	// 60FPS 本地平滑插值循环：仅在播放中且存在歌词时运行，限制最高 60FPS 消除高刷屏（180Hz/240Hz）多余重绘与 DWM 混色开销
	useEffect(() => {
		if (!isPlaying || !lyricsData || lyricsData.lines.length === 0) return

		let rafId: number
		let lastTick = 0
		const tick = (now: number) => {
			if (now - lastTick >= 16) {
				lastTick = now
				const { baseTimeMs, perfNow, isPlaying: playing } = syncAnchorRef.current
				if (playing) {
					const elapsed = performance.now() - perfNow
					setDisplayTimeMs(baseTimeMs + elapsed)
				}
			}
			rafId = requestAnimationFrame(tick)
		}

		rafId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(rafId)
	}, [isPlaying, lyricsData])

	const toggleLock = async () => {
		const nextLocked = !isLocked
		try {
			await invoke('set_ignore_cursor_events', { ignore: nextLocked })
			setIsLocked(nextLocked)
			if (nextLocked) {
				setShowLockToast(true)
			}
		} catch (err) {
			console.error('Failed to toggle lock mouse:', err)
		}
	}

	const adjustFontSize = (delta: number) => {
		setFontSize((prev) => {
			const next = Math.max(16, Math.min(38, prev + delta))
			try {
				localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(next))
			} catch {}
			return next
		})
	}

	const triggerMainAction = (
		action: 'play_pause' | 'prev_track' | 'next_track',
	) => {
		emit('global-shortcut-event', action).catch(() => {})
	}

	const handleClose = async () => {
		try {
			await emit('lyrics-visibility-change', false)
			await getCurrentWindow().hide()
		} catch (err) {
			console.error('Failed to hide window:', err)
		}
	}

	return (
		<div
			className={`w-full h-full flex flex-col justify-center items-center px-6 relative select-none transition-colors duration-300 group ${
				isLocked
					? 'bg-transparent border-0 border-transparent shadow-none ring-0 outline-none rounded-none'
					: 'bg-black/60 hover:bg-black/75 border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-2xl'
			}`}
			style={{
				background: 'transparent',
				backgroundColor: isLocked ? 'transparent' : undefined,
				boxShadow: isLocked ? 'none' : undefined,
				border: isLocked ? 'none' : undefined,
				borderColor: isLocked ? 'transparent' : undefined,
				borderWidth: isLocked ? '0px' : undefined,
				borderStyle: isLocked ? 'none' : undefined,
				outline: 'none',
				backdropFilter: isLocked ? 'none' : undefined,
				WebkitBackdropFilter: isLocked ? 'none' : undefined,
			}}
		>
			{/* Lock Notification Toast */}
			{showLockToast && (
				<div className="absolute top-2 px-3.5 py-1.5 rounded-full bg-black/85 border border-white/20 text-white/95 text-xs flex items-center gap-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-none z-50">
					<Lock className="w-3.5 h-3.5 text-[#00AEEC]" />
					<span>
						已开启鼠标穿透 · 按 <strong>Ctrl+Alt+L</strong> 或<strong>双击底栏歌词图标</strong>解锁
					</span>
				</div>
			)}

			{/* Top drag & control bar (hidden when mouse locked) */}
			{!isLocked && (
				<div
					data-tauri-drag-region
					className="absolute top-2 left-3 right-3 h-8 flex items-center justify-between px-3.5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 backdrop-blur-md rounded-xl cursor-move text-white/90 shadow-sm z-20"
				>
					<span
						data-tauri-drag-region
						className="text-[11px] font-medium tracking-wide truncate max-w-[42%]"
					>
						{title} · <span className="text-white/60">{artist}</span>
					</span>

					{/* Quick Playback & Font Controls */}
					<div className="flex items-center gap-1 flex-shrink-0">
						<button
							onClick={() => triggerMainAction('prev_track')}
							title="上一首"
							className="p-1 rounded-lg hover:bg-white/10 text-white/75 hover:text-white transition-colors"
						>
							<SkipBack className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={() => triggerMainAction('play_pause')}
							title={isPlaying ? '暂停' : '播放'}
							className="p-1 rounded-lg hover:bg-white/10 text-white/90 hover:text-[#00AEEC] transition-colors"
						>
							{isPlaying ? (
								<Pause className="w-3.5 h-3.5" />
							) : (
								<Play className="w-3.5 h-3.5" />
							)}
						</button>
						<button
							onClick={() => triggerMainAction('next_track')}
							title="下一首"
							className="p-1 rounded-lg hover:bg-white/10 text-white/75 hover:text-white transition-colors"
						>
							<SkipForward className="w-3.5 h-3.5" />
						</button>

						<div className="w-px h-3.5 bg-white/15 mx-1" />

						<button
							onClick={() => adjustFontSize(-2)}
							title="减小字号"
							className="px-1.5 py-0.5 rounded-lg hover:bg-white/10 text-[10px] font-mono text-white/75 hover:text-white transition-colors"
						>
							A-
						</button>
						<button
							onClick={() => adjustFontSize(2)}
							title="增大字号"
							className="px-1.5 py-0.5 rounded-lg hover:bg-white/10 text-[10px] font-mono text-white/75 hover:text-white transition-colors"
						>
							A+
						</button>

						<div className="w-px h-3.5 bg-white/15 mx-1" />

						<button
							onClick={toggleLock}
							title="锁定并开启鼠标穿透 (按 Ctrl+Alt+L 或右键底栏图标解锁)"
							className="p-1 rounded-lg hover:bg-white/10 text-white/75 hover:text-[#00AEEC] transition-colors"
						>
							<Lock className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={handleClose}
							title="隐藏桌面歌词 (Ctrl+Alt+D)"
							className="p-1 rounded-lg hover:bg-rose-500/80 text-white/75 hover:text-white transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			)}

			{/* Center: Syllable Lyric Text & Multi-language Lines */}
			{(() => {
				const baseFontSizes = getLyricFontSizes()
				const romajiFontSize = Math.max(10, Math.round(fontSize * (baseFontSizes.roma / baseFontSizes.main)))
				const transFontSize = Math.max(11, Math.round(fontSize * (baseFontSizes.trans / baseFontSizes.main)))

				return (
					<div
						data-tauri-drag-region={!isLocked ? true : undefined}
						className={`text-center space-y-1 w-full max-w-4xl px-4 flex flex-col items-center justify-center ${
							isLocked ? 'pointer-events-none' : 'cursor-move pt-3'
						}`}
					>
						{activeLine ? (
							<>
								{/* Romaji subline if available */}
								{activeLine.romaji && (
									<p
										className="font-mono tracking-wider truncate max-w-full pointer-events-none"
										style={{
											fontSize: `${romajiFontSize}px`,
											color: primaryColor,
											opacity: 0.85,
											filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
										}}
									>
										{activeLine.romaji}
									</p>
								)}

								{/* Main lyric line with 60fps/144fps rAF syllable karaoke highlight */}
								<p
									className="font-black tracking-wide leading-snug max-w-full line-clamp-2 px-2 pointer-events-none"
									style={{
										fontSize: `${fontSize}px`,
										filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))',
									}}
								>
									{activeLine.isDynamic &&
									activeLine.spans &&
									activeLine.spans.length > 0 ? (
										activeLine.spans.map((span, idx) => {
											let fillPct = 0
											if (displayTimeMs >= span.endTime) {
												fillPct = 100
											} else if (displayTimeMs > span.startTime) {
												fillPct = Math.min(
													100,
													((displayTimeMs - span.startTime) /
														Math.max(1, span.duration || span.endTime - span.startTime)) *
														100,
												)
											}

											return (
												<span
													key={idx}
													className="inline-block"
													style={{
														background: `linear-gradient(to right, ${primaryColor} ${fillPct}%, rgba(255, 255, 255, 0.92) ${fillPct}%)`,
														WebkitBackgroundClip: 'text',
														WebkitTextFillColor: 'transparent',
													}}
												>
													{span.text}
												</span>
											)
										})
									) : (
										<span style={{ color: primaryColor }}>
											{activeLine.content}
										</span>
									)}
								</p>

								{/* Chinese Translation line */}
								{activeLine.translation && (
									<p
										className="font-medium tracking-wide truncate max-w-full pt-0.5 pointer-events-none"
										style={{
											fontSize: `${transFontSize}px`,
											color: primaryColor,
											opacity: 0.9,
											filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
										}}
									>
										{activeLine.translation}
									</p>
								)}
							</>
						) : (
							<div className="space-y-1 pointer-events-none">
								<p
									className="font-bold text-white tracking-wide"
									style={{
										fontSize: `${fontSize}px`,
										filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
									}}
								>
									{title}
								</p>
								<p
									className="text-xs text-white/80 font-medium tracking-wider"
									style={{
										filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
									}}
								>
									{artist}
								</p>
							</div>
						)}
					</div>
				)
			})()}
		</div>
	)
}