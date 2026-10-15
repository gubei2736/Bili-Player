/**
 * 底部播放栏桌面歌词交互控制按钮代码片段 (提取自 apps/desktop/src/components/layout/BottomPlayerBar.tsx)
 * 职责：
 * 1. 左键单击：切换桌面歌词的显示/隐藏；
 * 2. 右键单击：快速锁定/解锁桌面歌词鼠标穿透；
 * 3. 联动 Tauri 后端命令 'toggle_lyrics_window' 与 'toggle_lyrics_lock'。
 */

import React from 'react'
import { Monitor } from 'lucide-react'

export interface DesktopLyricsControlsProps {
	onToggleLyricsWindow?: () => void
}

export const DesktopLyricsButton: React.FC<DesktopLyricsControlsProps> = ({
	onToggleLyricsWindow,
}) => {
	const handleToggleDesktopLyrics = async () => {
		if (onToggleLyricsWindow) {
			onToggleLyricsWindow()
		} else {
			try {
				const { invoke } = await import('@tauri-apps/api/core')
				await invoke('toggle_lyrics_window')
			} catch {}
		}
	}

	return (
		<button
			onClick={handleToggleDesktopLyrics}
			onContextMenu={async (e) => {
				e.preventDefault()
				try {
					const { invoke } = await import('@tauri-apps/api/core')
					await invoke('toggle_lyrics_lock')
				} catch (err) {
					console.warn('Failed to toggle lyrics lock:', err)
				}
			}}
			title="桌面歌词 (左键显示/隐藏，右键锁定/解锁穿透)"
			className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-[#00AEEC] transition-colors"
		>
			<Monitor className="w-4 h-4" />
		</button>
	)
}
