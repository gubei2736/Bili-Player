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
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTimeMs, setCurrentTimeMs] = useState(0)
	const [title, setTitle] = useState('BBPlayer 桌面歌词')
	const [artist, setArtist] = useState('欢迎使用')
	const [splContent, setSplContent] = useState<string | null>(null)
	const [fontSize, setFontSize] = useState(22)
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
			setIsLocked( Boolean(event.payload) )
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
					? 'bg-transparent'
					: 'bg-black/55 hover:bg-black/75 border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]'
			}`}
		>
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
							title="锁定/穿透鼠标 (Ctrl+Alt+L 解锁)"
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

			{/* Center: Syllable Lyric Text & Multi-language Lines */}
			<div className="text-center space-y-1.5 pointer-events-none w-full max-w-3xl px-4 flex flex-col items-center justify-center">
				{activeLine ? (
					<>
						{/* Romaji subline if available */}
						{activeLine.romaji && (
							<p
								className="text-[12px] md:text-[13px] text-white/80 font-mono tracking-wider truncate max-w-full"
								style={{
									textShadow:
										'0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)',
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
								textShadow:
									'0 2px 4px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,1)',
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
												background: `linear-gradient(to right, ${primaryColor} ${fillPct}%, rgba(255, 255, 255, 0.85) ${fillPct}%)`,
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
									className="drop-shadow-[0_2px_12px_rgba(0,174,236,0.7)]"
								>
									{activeLine.content}
								</span>
							)}
						</p>

						{/* Chinese Translation line */}
						{activeLine.translation && (
							<p
								className="text-xs md:text-sm text-sky-200/95 font-medium tracking-wide truncate max-w-full pt-0.5"
								style={{
									textShadow:
										'0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.85)',
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
								textShadow:
									'0 2px 8px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.85)',
							}}
						>
							{title}
						</p>
						<p
							className="text-xs text-white/70 font-medium tracking-wider"
							style={{
								textShadow: '0 1px 4px rgba(0,0,0,0.9)',
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