import React from 'react'
import {
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Monitor,
	Lock,
	Settings,
	Minimize2,
	Maximize2,
	Power,
	Music,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { emit } from '@tauri-apps/api/event'

export const TrayMenuApp: React.FC = () => {
	const closeMenu = async () => {
		try {
			await getCurrentWindow().hide()
		} catch {}
	}

	const handleOpenMain = async () => {
		await closeMenu()
		try {
			await invoke('restore_main_from_mini')
		} catch {}
	}

	const handleOpenSettings = async () => {
		await closeMenu()
		try {
			await invoke('restore_main_from_mini')
			await emit('navigate-to-tab', 'settings')
		} catch {}
	}

	const handleToggleMini = async () => {
		await closeMenu()
		try {
			await invoke('toggle_mini_player')
		} catch {}
	}

	const handleShortcut = async (action: string) => {
		await closeMenu()
		try {
			await emit('global-shortcut-event', action)
		} catch {}
	}

	const handleToggleLyrics = async () => {
		await closeMenu()
		try {
			await invoke('toggle_lyrics_window')
		} catch {}
	}

	const handleToggleLyricsLock = async () => {
		await closeMenu()
		try {
			await invoke('toggle_lyrics_lock')
		} catch {}
	}

	const handleExit = async () => {
		await closeMenu()
		try {
			await invoke('exit_app')
		} catch {}
	}

	return (
		<div className="w-full h-full p-2 bg-[#0e121e]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl flex flex-col justify-between text-xs select-none text-white overflow-hidden">
			{/* Brand Header */}
			<div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-xl bg-white/[0.04] border border-white/5">
				<div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#00AEEC] to-[#FB7299] flex items-center justify-center shadow-sm">
					<Music className="w-3 h-3 text-white" />
				</div>
				<span className="font-semibold text-white/90 tracking-wide text-[11px]">
					Bili Player
				</span>
			</div>

			{/* Main Actions */}
			<div className="space-y-0.5">
				<button
					onClick={handleOpenMain}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<Maximize2 className="w-3.5 h-3.5 text-[#00AEEC]" />
					<span>打开主界面</span>
				</button>

				<button
					onClick={handleToggleMini}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
					<span>迷你播放器</span>
				</button>

				<button
					onClick={handleOpenSettings}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<Settings className="w-3.5 h-3.5 text-white/60" />
					<span>偏好设置...</span>
				</button>
			</div>

			<div className="h-px bg-white/10 my-1" />

			{/* Playback Controls */}
			<div className="space-y-0.5">
				<button
					onClick={() => handleShortcut('play_pause')}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<Play className="w-3.5 h-3.5 text-emerald-400" />
					<span>播放 / 暂停</span>
				</button>

				<button
					onClick={() => handleShortcut('prev_track')}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<SkipBack className="w-3.5 h-3.5 text-white/60" />
					<span>上一首</span>
				</button>

				<button
					onClick={() => handleShortcut('next_track')}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<SkipForward className="w-3.5 h-3.5 text-white/60" />
					<span>下一首</span>
				</button>
			</div>

			<div className="h-px bg-white/10 my-1" />

			{/* Lyrics Controls */}
			<div className="space-y-0.5">
				<button
					onClick={handleToggleLyrics}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<Monitor className="w-3.5 h-3.5 text-sky-400" />
					<span>显示 / 隐藏桌面歌词</span>
				</button>

				<button
					onClick={handleToggleLyricsLock}
					className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/85 hover:text-white transition-colors text-left"
				>
					<Lock className="w-3.5 h-3.5 text-amber-400" />
					<span>锁定 / 解锁桌面歌词</span>
				</button>
			</div>

			<div className="h-px bg-white/10 my-1" />

			{/* Exit */}
			<button
				onClick={handleExit}
				className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/15 text-white/75 hover:text-rose-400 transition-colors text-left"
			>
				<Power className="w-3.5 h-3.5" />
				<span>退出 Bili Player</span>
			</button>
		</div>
	)
}
