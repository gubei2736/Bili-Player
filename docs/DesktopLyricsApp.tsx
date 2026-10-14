import React, { useState, useEffect, useMemo } from 'react'
import {
	Lock,
	Unlock,
	X,
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Settings,
} from 'lucide-react'
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

	// IPC Event Listener from Main Window
	useEffect(() => {
		const unlistenPromise = listen<LyricsSyncEvent>('lyrics-sync', (event) => {
			const payload = event.payload
			if (payload.type === 'TRACK_CHANGE') {
				setTitle(payload.title)
				setArtist(payload.artist)
				setSplContent(payload.splContent || null)
			} else if (payload.type === 'STATE_SYNC') {
				setIsPlaying(payload.isPlaying)
				setCurrentTimeMs(payload.currentTimeMs)
			} else if (payload.type === 'STYLE_UPDATE') {
				setFontSize(payload.fontSize)
				setPrimaryColor(payload.primaryColor)
				if (payload.lockMouse !== isLocked) {
					setIsLocked(payload.lockMouse)
				}
			}
		})

		return () => {
			unlistenPromise.then((unlisten) => unlisten())
		}
	}, [isLocked])

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
					: 'bg-black/50 hover:bg-black/70 border border-white/10 backdrop-blur-md shadow-2xl'
			}`}
		>
			{/* Top drag & control bar (hidden when mouse locked) */}
			{!isLocked && (
				<div
					data-tauri-drag-region
					className="absolute top-0 left-0 right-0 h-7 flex items-center justify-between px-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-t-2xl cursor-move text-white/80"
				>
					<span className="text-[11px] font-medium tracking-wide">
						{title} - {artist}
					</span>
					<div className="flex items-center gap-1.5">
						<button
							onClick={toggleLock}
							title="锁定/穿透鼠标 (Alt+Shift+L 解锁)"
							className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
						>
							<Lock className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={handleClose}
							title="关闭桌面歌词"
							className="p-1 rounded hover:bg-red-500/80 text-white/70 hover:text-white transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			)}

			{/* Center: Syllable Lyric Text */}
			<div className="text-center space-y-1 pointer-events-none w-full max-w-2xl px-4">
				{activeLine ? (
					<>
						<p
							className="font-bold tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] leading-tight transition-all"
							style={{ fontSize: `${fontSize}px` }}
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
												background: `linear-gradient(to right, ${primaryColor} ${fillPct}%, rgba(255, 255, 255, 0.7) ${fillPct}%)`,
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
									className="drop-shadow-[0_2px_8px_rgba(0,174,236,0.6)]"
								>
									{activeLine.content}
								</span>
							)}
						</p>

						{/* Translation or subline */}
						{activeLine.translation && (
							<p className="text-xs text-white/75 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] truncate">
								{activeLine.translation}
							</p>
						)}
					</>
				) : (
					<div className="space-y-0.5">
						<p
							className="font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
							style={{ fontSize: `${fontSize}px` }}
						>
							{title}
						</p>
						<p className="text-xs text-white/60 font-medium">{artist}</p>
					</div>
				)}
			</div>
		</div>
	)
}
