/**
 * 桌面歌词与主窗口桥接代码片段 (提取自 apps/desktop/src/App.tsx)
 * 职责：
 * 1. 监听音频引擎的高频时间与状态变化，节流并高精度广播 'lyrics-sync' (STATE_SYNC)；
 * 2. 监听当前曲目切换与 SPL 歌词解析更新，广播 'lyrics-sync' (TRACK_CHANGE)；
 * 3. 响应桌面歌词窗口的显隐切换与锁定控制。
 */

import { useEffect, useRef } from 'react'
import { emit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { desktopAudioEngine } from './audio/DesktopAudioEngine'
import { getStoredLyricOffset } from './services/lyricService'
import type { Track } from '@bbplayer/shared-core'

export function useDesktopLyricsBridge(currentTrack: Track | null, activeSplContent: string | null) {
	const currentTrackRef = useRef(currentTrack)
	currentTrackRef.current = currentTrack

	// 1. 高频音频状态同步（高帧率节流 200ms 或播放状态改变时即刻发送）
	useEffect(() => {
		let lastSentMs = 0
		let lastPlayState = false
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			const now = Date.now()
			const isPlaying = desktopAudioEngine.isPlaying()
			if (isPlaying !== lastPlayState || now - lastSentMs > 200) {
				lastSentMs = now
				lastPlayState = isPlaying
				const activeTrack = currentTrackRef.current
				const offsetSec = activeTrack ? getStoredLyricOffset(activeTrack.uniqueKey) : 0
				emit('lyrics-sync', {
					type: 'STATE_SYNC',
					isPlaying,
					currentTimeMs: Math.max(0, (event.currentTime + offsetSec) * 1000),
					timestamp: now,
				}).catch(() => {})
			}
		})
		return unsubscribe
	}, [])

	// 2. 歌曲变更与 SPL 歌词内容同步（支持多分 P 标题识别与双语/罗马音）
	useEffect(() => {
		if (currentTrack) {
			const bili = currentTrack.source === 'bilibili' ? (currentTrack as any) : null
			const displayTitle =
				bili?.bilibiliMetadata?.isMultiPage && (bili.bilibiliMetadata.pagePart || bili.bilibiliMetadata.pageIndex)
					? `[P${bili.bilibiliMetadata.pageIndex || 1}] ${bili.bilibiliMetadata.pagePart || currentTrack.title}`
					: currentTrack.title

			emit('lyrics-sync', {
				type: 'TRACK_CHANGE',
				title: displayTitle,
				artist: currentTrack.artist?.name || '未知歌手',
				durationMs: (currentTrack.duration || 0) * 1000,
				splContent: activeSplContent || undefined,
			}).catch(() => {})
		}
	}, [currentTrack, activeSplContent])

	// 3. 打开/隐藏桌面歌词窗口
	const toggleLyricsWindow = async () => {
		try {
			await invoke('toggle_lyrics_window')
		} catch (err) {
			console.warn('Lyrics window invoke fallback:', err)
		}
	}

	return { toggleLyricsWindow }
}
