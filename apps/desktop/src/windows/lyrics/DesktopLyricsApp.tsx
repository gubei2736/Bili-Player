import React, { useState, useEffect, useMemo } from 'react'
import { Lock, X } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { parseSpl, type SplLyricData, type LyricLine } from '@bbplayer/splash'

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

export const DesktopLyricsApp: React.FC = () => {
	const [isLocked, setIsLocked] = useState(false)
	const [showLockToast, setShowLockToast] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTimeMs, setCurrentTimeMs] = useState(0)
	const [title, setTitle] = useState('Bili Player 桌面歌词')
	const [artist, setArtist] = useState('沉浸音乐体验')
	const [splContent, setSplContent] = useState<string | null>(null)
	const [fontSize, setFontSize] = useState(24)
	const [primaryColor, setPrimaryColor] = useState('#00AEEC')

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
		const unlistenSyncPromise = listen<LyricsSyncEvent>('lyrics-sync', (event) => {
			const payload = event.payload
			if (payload.type === 'TRACK_CHANGE') {
				setTitle(payload.title)
				setArtist(payload.artist)
				if (payload.splContent !== undefined) {
					setSplContent(payload.splContent || null)
				}
			} else if (payload.type === 'STATE_SYNC') {
				setIsPlaying(payload.isPlaying)
				setCurrentTimeMs(payload.currentTimeMs)
			} else if (payload.type === 'STYLE_UPDATE') {
				setFontSize(payload.fontSize)
				setPrimaryColor(payload.primaryColor)
				setIsLocked(payload.lockMouse)
			}
		})

		const unlistenLockPromise = listen<boolean>('lyrics-lock-change', (event) => {
			const locked = Boolean(event.payload)
			setIsLocked(locked)
			if (locked) {
				setShowLockToast(true)
			}
		})

		return () => {
			unlistenSyncPromise.then((unlisten) => unlisten())
			unlistenLockPromise.then((unlisten) => unlisten())
		}
	}, [])

	// Determine active line
	const activeLine: LyricLine | null = useMemo(() => {
		if (!lyricsData || lyricsData.lines.length === 0) return null
		for (const line of lyricsData.lines) {
			if (currentTimeMs >= line.startTime && currentTimeMs < line.endTime) {
				return line
			}
		}
		for (let i = lyricsData.lines.length - 1; i >= 0; i--) {
			if (currentTimeMs >= lyricsData.lines[i]!.startTime) {
				return lyricsData.lines[i]!
			}
		}
		return lyricsData.lines[0] || null
	}, [lyricsData, currentTimeMs])

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

	const handleClose = async () => {
		try {
			await getCurrentWindow().hide()
		} catch (err) {
			console.error('Failed to hide window:', err)
		}
	}

	return (
		<div
			className={`w-screen h-screen flex flex-col justify-center items-center px-6 relative select-none rounded-2xl transition-all duration-300 group ${
				isLocked
					? 'bg-transparent border-0 border-transparent shadow-none ring-0 outline-none'
					: 'bg-black/60 hover:bg-black/75 border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]'
			}`}
			style={{
				background: isLocked ? 'transparent' : undefined,
				backgroundColor: isLocked ? 'transparent' : undefined,
				boxShadow: isLocked ? 'none' : undefined,
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
					<span>已锁定 · 双击歌词或按 <strong>Ctrl+Alt+L</strong> 解锁</span>
				</div>
			)}

			{/* Top drag & control bar (hidden when mouse locked) */}
			{!isLocked && (
				<div
					data-tauri-drag-region
					className="absolute top-2 left-3 right-3 h-8 flex items-center justify-between px-3.5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 backdrop-blur-md rounded-xl cursor-move text-white/90 shadow-sm"
				>
					<span className="text-[11px] font-medium tracking-wide truncate max-w-[70%]">
						{title} · <span className="text-white/60">{artist}</span>
					</span>
					<div className="flex items-center gap-1.5 flex-shrink-0">
						<button
							onClick={toggleLock}
							title="锁定/双击歌词解锁 (Ctrl+Alt+L)"
							className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
						>
							<Lock className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={handleClose}
							title="关闭桌面歌词"
							className="p-1 rounded-lg hover:bg-rose-500/80 text-white/70 hover:text-white transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			)}

			{/* Center: Syllable Lyric Text & Multi-language Lines - double click to toggle lock */}
			<div
				onDoubleClick={toggleLock}
				className="text-center space-y-1.5 pointer-events-auto cursor-pointer w-full max-w-3xl px-4 flex flex-col items-center justify-center"
				title={isLocked ? '双击歌词解锁' : '双击歌词锁定'}
			>
				{activeLine ? (
					<>
						{/* Romaji subline if available */}
						{activeLine.romaji && (
							<p
								className="text-[12px] md:text-[13px] text-white/90 font-mono tracking-wider truncate max-w-full"
								style={{
									filter:
										'drop-shadow(0 1px 2px rgba(0,0,0,0.95)) drop-shadow(0 0 6px rgba(0,0,0,0.9))',
								}}
							>
								{activeLine.romaji}
							</p>
						)}

						{/* Main lyric line with syllable karaoke dynamic highlight */}
						<p
							className="font-black tracking-wide leading-tight transition-all max-w-full truncate px-2"
							style={{
								fontSize: `${fontSize}px`,
								filter:
									'drop-shadow(0 2px 4px rgba(0,0,0,0.95)) drop-shadow(0 0 10px rgba(0,0,0,0.9)) drop-shadow(0 0 2px rgba(0,0,0,1))',
							}}
						>
							{activeLine.isDynamic &&
							activeLine.spans &&
							activeLine.spans.length > 0 ? (
								activeLine.spans.map((span, idx) => {
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
											key={idx}
											className="inline-block transition-all duration-75"
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
								<span
									style={{ color: primaryColor }}
									className="drop-shadow-[0_2px_12px_rgba(0,174,236,0.8)]"
								>
									{activeLine.content}
								</span>
							)}
						</p>

						{/* Chinese Translation line */}
						{activeLine.translation && (
							<p
								className="text-xs md:text-sm text-sky-200 font-medium tracking-wide truncate max-w-full pt-0.5"
								style={{
									filter:
										'drop-shadow(0 1px 3px rgba(0,0,0,0.95)) drop-shadow(0 0 6px rgba(0,0,0,0.85))',
								}}
							>
								{activeLine.translation}
							</p>
						)}
					</>
				) : (
					<div className="space-y-1">
						<p
							className="font-bold text-white tracking-wide"
							style={{
								fontSize: `${fontSize}px`,
								filter:
									'drop-shadow(0 2px 6px rgba(0,0,0,0.95)) drop-shadow(0 0 10px rgba(0,0,0,0.85))',
							}}
						>
							{title}
						</p>
						<p
							className="text-xs text-white/80 font-medium tracking-wider"
							style={{
								filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))',
							}}
						>
							{artist}
						</p>
					</div>
				)}
			</div>
		</div>
	)
}