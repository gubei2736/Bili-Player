import React, { useState, useEffect } from 'react'
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

export const DesktopLyricsApp: React.FC = () => {
	const [isLocked, setIsLocked] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentLine, setCurrentLine] = useState('BBPlayer 桌面歌词已就绪')
	const [subLine, setSubLine] = useState('聆听好音乐，随时随地')
	const [fontSize, setFontSize] = useState(24)

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
					: 'bg-black/40 hover:bg-black/60 border border-white/10 backdrop-blur-md shadow-2xl'
			}`}
		>
			{/* Top drag & control bar (hidden when locked) */}
			{!isLocked && (
				<div
					data-tauri-drag-region
					className="absolute top-0 left-0 right-0 h-8 flex items-center justify-between px-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-t-2xl cursor-move"
				>
					<span className="text-[11px] font-medium text-white/70">
						BBPlayer 桌面悬浮歌词
					</span>
					<div className="flex items-center gap-1">
						<button
							onClick={toggleLock}
							title="锁定/穿透鼠标 (Alt+Shift+L 解锁)"
							className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white"
						>
							<Lock className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={handleClose}
							title="关闭桌面歌词"
							className="p-1 rounded hover:bg-red-500/80 text-white/70 hover:text-white"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			)}

			{/* Center: Lyrics Text Display */}
			<div className="text-center space-y-1 pointer-events-none">
				<p
					className="font-bold tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-sky-300 to-indigo-300 animate-pulse"
					style={{ fontSize: `${fontSize}px` }}
				>
					{currentLine}
				</p>
				{subLine && (
					<p className="text-xs text-white/70 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
						{subLine}
					</p>
				)}
			</div>
		</div>
	)
}
