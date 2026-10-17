import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
	Music,
	Play,
	TrendingUp,
	Sparkles,
	CheckCircle2,
	Download,
} from 'lucide-react'
import { MainLayout } from './components/layout/MainLayout'
import type { NavTab } from './components/layout/Sidebar'
import { LoginModal } from './components/modals/LoginModal'
import { PlaylistImportModal } from './components/modals/PlaylistImportModal'
import { CreatePlaylistModal } from './components/modals/CreatePlaylistModal'
import { ExportTrackModal } from './components/modals/ExportTrackModal'
import { ImmersiveLyricsView } from './components/player/ImmersiveLyricsView'
import {
	lyricService,
	getStoredLyricOffset,
	getAutoMatchLyricsEnabled,
	getStoredCustomLyric,
} from './services/lyricService'
import { SkinStoreView, applyFontColorToDom } from './components/views/SkinStoreView'
import { HistoryHeatmapView } from './components/views/HistoryHeatmapView'
import { SearchView } from './components/views/SearchView'
import { ShortcutsSettingsView } from './components/views/ShortcutsSettingsView'
import { FavoritesView } from './components/views/FavoritesView'
import { CollectionsView } from './components/views/CollectionsView'
import { LibraryView } from './components/views/LibraryView'
import { AudioQualitySettingsCard } from './components/views/AudioQualitySettingsCard'
import { LyricsSettingsCard } from './components/views/LyricsSettingsCard'
import { initDesktopDatabase } from './db/desktopDb'
import { loginQrService } from './services/loginQrService'
import {
	useQueueStore,
	useCurrentTrack,
	useSkinStore,
	useAuthStore,
	usePlaylistStore,
	bilibiliApi,
	type Track,
	type Artist,
} from '@bbplayer/shared-core'
import { desktopAudioEngine } from './audio/DesktopAudioEngine'
import { playTrackWithProxy } from './audio/playTrackHelper'
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'

const dummyArtist = (id: number, name: string): Artist => ({
	id,
	name,
	source: 'bilibili',
	createdAt: new Date(),
	updatedAt: new Date(),
})

function hexToRgbTriple(hex: string): string {
	let c = hex.replace('#', '')
	if (c.length === 3) {
		c = c
			.split('')
			.map((x) => x + x)
			.join('')
	}
	const num = parseInt(c, 16)
	if (Number.isNaN(num)) return '0 174 236'
	const r = (num >> 16) & 255
	const g = (num >> 8) & 255
	const b = num & 255
	return `${r} ${g} ${b}`
}

export const App: React.FC = () => {
	const [loginModalOpen, setLoginModalOpen] = useState(false)
	const [playlistImportOpen, setPlaylistImportOpen] = useState(false)
	const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false)
	const [activeSplContent, setActiveSplContent] = useState<string>('')
	const [isMatchingLyrics, setIsMatchingLyrics] = useState(false)
	const [exportModalTrack, setExportModalTrack] = useState<Track | null>(null)
	const [fullscreenLyricsOpen, setFullscreenLyricsOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<NavTab>('explore')
	const [searchQuery, setSearchQuery] = useState('')
	const [dbReady, setDbReady] = useState(false)
	const [closeAction, setCloseAction] = useState<'tray' | 'exit'>(() => {
		return (
			(localStorage.getItem('bili_player_close_action') as 'tray' | 'exit') ||
			(localStorage.getItem('bbplayer_close_action') as 'tray' | 'exit') ||
			'tray'
		)
	})
	const [featuredTracks, setFeaturedTracks] = useState<Track[]>([
		{
			id: 1,
			uniqueKey: 'bilibili_BV1GJ411x7h7_0',
			title: '【官方 MV】Never Gonna Give You Up - Rick Astley',
			artist: dummyArtist(101, '索尼音乐中国'),
			coverUrl: 'https://i1.hdslb.com/bfs/archive/5242750857121e05146d5d5b13a47a2a6dd36e98.jpg',
			duration: 213,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1GJ411x7h7',
				cid: 137649199,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 2,
			uniqueKey: 'bilibili_BV1EYwxePEHJ_0',
			title: '《原神》特别EP - 「幽谷舟咏」',
			artist: dummyArtist(102, '原神'),
			coverUrl: 'https://i2.hdslb.com/bfs/archive/ff495d93efb4fd3921ed5f216601d7455598c074.jpg',
			duration: 134,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1EYwxePEHJ',
				cid: 27983873703,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 3,
			uniqueKey: 'bilibili_BV1Sg411w7T9_0',
			title: '【官方MV】宇多田光 - 《One Last Kiss》',
			artist: dummyArtist(103, '宇多田光'),
			coverUrl: 'https://i1.hdslb.com/bfs/archive/0b8cae3ed099b9697d35d184c7fd3cd9c34f119f.jpg',
			duration: 260,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1Sg411w7T9',
				cid: 464871141,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 4,
			uniqueKey: 'bilibili_BV1eg411U7h3_0',
			title: '【混沌武士】四季ノ唄 -Jazz Ver.-【Himawari翻唱】',
			artist: dummyArtist(104, '-Himawari-'),
			coverUrl: 'https://i2.hdslb.com/bfs/archive/e4e451d42aebbe1fb0cbe978eb7fa87d528a451a.jpg',
			duration: 170,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1eg411U7h3',
				cid: 832811547,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
	])

	const { setQueue, next, prev } = useQueueStore()
	const currentTrack = useCurrentTrack()
	const { isLoggedIn, userInfo } = useAuthStore()
	const { syncRemotePlaylists } = usePlaylistStore()

	// Auto sync remote playlists and collections when logged in
	useEffect(() => {
		if (isLoggedIn && userInfo?.mid) {
			syncRemotePlaylists(userInfo.mid).catch((err) => {
				console.warn('Auto sync remote playlists failed:', err)
			})
		}
	}, [isLoggedIn, userInfo?.mid, syncRemotePlaylists])

	// Auto fetch lyrics dynamically for current track (clean previous song lyrics immediately)
	useEffect(() => {
		let cancelled = false
		setActiveSplContent('')
		if (currentTrack) {
			const autoEnabled = getAutoMatchLyricsEnabled()
			const custom = getStoredCustomLyric(currentTrack.uniqueKey)
			if (autoEnabled || custom) {
				setIsMatchingLyrics(true)
			} else {
				setIsMatchingLyrics(false)
			}

			lyricService
				.fetchLyricForTrack(currentTrack)
				.then((res) => {
					if (!cancelled) {
						setActiveSplContent(res?.splContent || '')
						setIsMatchingLyrics(false)
					}
				})
				.catch(() => {
					if (!cancelled) {
						setIsMatchingLyrics(false)
					}
				})
		} else {
			setIsMatchingLyrics(false)
		}
		return () => {
			cancelled = true
		}
	}, [currentTrack?.uniqueKey])

	useEffect(() => {
		const handleAutoMatchChange = (e: any) => {
			const enabled = e.detail?.enabled ?? getAutoMatchLyricsEnabled()
			if (!enabled && !activeSplContent) {
				setIsMatchingLyrics(false)
			}
		}
		window.addEventListener('bbplayer:auto-match-lyrics-change', handleAutoMatchChange)
		return () => {
			window.removeEventListener('bbplayer:auto-match-lyrics-change', handleAutoMatchChange)
		}
	}, [activeSplContent])

	useEffect(() => {
		const handleCustom = (e: any) => {
			if (e.detail?.trackKey === currentTrack?.uniqueKey) {
				setActiveSplContent(e.detail.splContent)
			}
		}
		window.addEventListener('bbplayer:custom-lyric-change', handleCustom)
		return () => {
			window.removeEventListener('bbplayer:custom-lyric-change', handleCustom)
		}
	}, [currentTrack?.uniqueKey])

	// 1. Initialize DB
	useEffect(() => {
		initDesktopDatabase()
			.then(() => setDbReady(true))
			.catch((e) => console.warn('Database initialization note:', e))

		if (!useAuthStore.getState().isLoggedIn) {
			loginQrService.getOrFetch().catch(() => {})
		}
	}, [])

	// 2. Initialize active theme skin colors & font colors
	const customTextColor = useSkinStore((s) => s.customTextColor)
	useEffect(() => {
		applyFontColorToDom(customTextColor)
	}, [customTextColor])

	useEffect(() => {
		const skin = useSkinStore.getState().activeSkinSuit
		const color = skin?.suit_items?.skin?.[0]?.properties?.color
		if (color) {
			const rgb = hexToRgbTriple(color)
			document.documentElement.style.setProperty('--primary-rgb', rgb)
			document.documentElement.style.setProperty('--primary', color)
			document.documentElement.style.setProperty('--bili-theme-primary', color)
			document.documentElement.style.setProperty('--ring', color)
		}
	}, [])

	// 2.1 Fetch online trending music dynamically on mount
	useEffect(() => {
		const loadTracks = async () => {
			try {
				let tracks: Track[] = []
				const popRes = await bilibiliApi.getPopularVideos({ partition: '28' })
				if (popRes.isOk() && popRes.value && popRes.value.length > 0) {
					tracks = popRes.value.slice(0, 12).map((item, idx) => {
						let cover = item.pic || ''
						if (cover.startsWith('//')) cover = 'https:' + cover
						return {
							id: idx + 100,
							uniqueKey: `bilibili_${item.bvid}_0`,
							title: item.title.replace(/<[^>]*>?/gm, ''),
							artist: {
								id: item.owner?.mid || idx + 100,
								name: item.owner?.name || '哔哩哔哩音乐人',
								source: 'bilibili',
								createdAt: new Date(),
								updatedAt: new Date(),
							},
							coverUrl: cover,
							duration: item.duration || 240,
							source: 'bilibili',
							createdAt: new Date(),
							updatedAt: new Date(),
							bilibiliMetadata: {
								bvid: item.bvid,
								cid: item.cid || null,
								isMultiPage: Boolean(item.pages && item.pages.length > 1),
								videoIsValid: true,
							},
						}
					})
				} else {
					const res = await bilibiliApi.searchVideos({ keyword: '热门音乐', page: 1 })
					if (res.isOk() && res.value.result && res.value.result.length > 0) {
						tracks = res.value.result.slice(0, 10).map((item, idx) => {
							let cover = item.pic || ''
							if (cover.startsWith('//')) cover = 'https:' + cover
							return {
								id: idx + 100,
								uniqueKey: `bilibili_${item.bvid}_0`,
								title: item.title.replace(/<[^>]*>?/gm, ''),
								artist: {
									id: item.mid || idx + 100,
									name: item.author || '哔哩哔哩音乐人',
									source: 'bilibili',
									createdAt: new Date(),
									updatedAt: new Date(),
								},
								coverUrl: cover,
								duration: 240,
								source: 'bilibili',
								createdAt: new Date(),
								updatedAt: new Date(),
								bilibiliMetadata: {
									bvid: item.bvid,
									cid: null,
									isMultiPage: false,
									videoIsValid: true,
								},
							}
						})
					}
				}
				if (tracks.length > 0) {
					setFeaturedTracks(tracks)
				}
			} catch (e) {
				console.warn('Failed to load featured tracks:', e)
			}
		}
		loadTracks()
	}, [])

	// 2.2 Sync saved shortcuts to Rust on startup & auto-migrate Alt+Shift and Left/Right/Up/Down
	useEffect(() => {
		try {
			const saved = localStorage.getItem('bbplayer_shortcuts')
			if (saved) {
				let configs = JSON.parse(saved)
				let upgraded = false
				if (Array.isArray(configs)) {
					configs = configs.map((c: any) => {
						if (typeof c.key === 'string') {
							let newKey = c.key
							if (newKey.includes('Alt+Shift')) {
								newKey = newKey.replace(/Alt\+Shift/g, 'Ctrl+Alt')
								upgraded = true
							}
							if (newKey.includes('Left') && !newKey.includes('ArrowLeft')) {
								newKey = newKey.replace(/\bLeft\b/g, 'ArrowLeft')
								upgraded = true
							}
							if (newKey.includes('Right') && !newKey.includes('ArrowRight')) {
								newKey = newKey.replace(/\bRight\b/g, 'ArrowRight')
								upgraded = true
							}
							if (newKey.includes('Up') && !newKey.includes('ArrowUp')) {
								newKey = newKey.replace(/\bUp\b/g, 'ArrowUp')
								upgraded = true
							}
							if (newKey.includes('Down') && !newKey.includes('ArrowDown')) {
								newKey = newKey.replace(/\bDown\b/g, 'ArrowDown')
								upgraded = true
							}
							return { ...c, key: newKey }
						}
						return c
					})
					if (upgraded) {
						localStorage.setItem('bbplayer_shortcuts', JSON.stringify(configs))
					}
					if (configs.length > 0) {
						invoke('update_shortcuts', { configs }).catch(() => {})
					}
				}
			}
		} catch {}
	}, [])

	const handlePlayTrack = useCallback(
		async (track: Track, index: number) => {
			setQueue(featuredTracks, index)
			try {
				await playTrackWithProxy(track)
			} catch (err) {
				console.error('Failed to play track with proxy:', err)
			}
		},
		[featuredTracks, setQueue],
	)

	const lastShortcutTriggerTimeRef = useRef<number>(0)

	const handleGlobalShortcutAction = useCallback((action: string) => {
		const now = Date.now()
		if (now - lastShortcutTriggerTimeRef.current < 150) return
		lastShortcutTriggerTimeRef.current = now

		const queueStore = useQueueStore.getState()
		const current = queueStore.getCurrentTrack()

		if (action === 'play_pause') {
			if (desktopAudioEngine.isPlaying()) {
				desktopAudioEngine.pause()
			} else {
				if (!current && queueStore.queue.length > 0) {
					playTrackWithProxy(queueStore.queue[0]!).catch(() => {})
				} else {
					desktopAudioEngine.play()
				}
			}
		} else if (action === 'prev_track') {
			const prevTrack = queueStore.prev()
			if (prevTrack) {
				playTrackWithProxy(prevTrack).catch(() => {})
			}
		} else if (action === 'next_track') {
			const nextTrack = queueStore.next()
			if (nextTrack) {
				playTrackWithProxy(nextTrack).catch(() => {})
			}
		}
	}, [])

	// 3. Global Shortcuts IPC Event Listener & Eval Hook (Permanent mount)
	useEffect(() => {
		;(window as any).__triggerGlobalShortcut = (action: string) => {
			handleGlobalShortcutAction(action)
		}

		let unlistenFn: (() => void) | undefined
		listen<string>('global-shortcut-event', (event) => {
			handleGlobalShortcutAction(event.payload)
		})
			.then((fn) => {
				unlistenFn = fn
			})
			.catch(() => {})

		return () => {
			delete (window as any).__triggerGlobalShortcut
			if (unlistenFn) unlistenFn()
		}
	}, [handleGlobalShortcutAction])

	// 4. In-App Single-Key & Global Shortcuts Handling
	useEffect(() => {
		const matchesShortcut = (e: KeyboardEvent, shortcutStr?: string): boolean => {
			if (!shortcutStr) return false
			const parts = shortcutStr.split('+').map((p) => p.trim())
			const mainKey = parts[parts.length - 1]!.toLowerCase()
			const hasCtrl = parts.some((p) => p.toLowerCase() === 'ctrl' || p.toLowerCase() === 'control')
			const hasAlt = parts.some((p) => p.toLowerCase() === 'alt')
			const hasShift = parts.some((p) => p.toLowerCase() === 'shift')
			const hasMeta = parts.some((p) => ['super', 'meta', 'win'].includes(p.toLowerCase()))

			if (e.ctrlKey !== hasCtrl) return false
			if (e.altKey !== hasAlt) return false
			if (e.shiftKey !== hasShift) return false
			if (e.metaKey !== hasMeta) return false

			const eventKey = e.key.toLowerCase()
			const eventCode = e.code.toLowerCase()

			if (mainKey === 'space' && (eventCode === 'space' || eventKey === ' ')) return true
			if (
				(mainKey === 'left' || mainKey === 'arrowleft') &&
				(eventCode === 'arrowleft' || eventKey === 'arrowleft')
			)
				return true
			if (
				(mainKey === 'right' || mainKey === 'arrowright') &&
				(eventCode === 'arrowright' || eventKey === 'arrowright')
			)
				return true
			if (
				(mainKey === 'up' || mainKey === 'arrowup') &&
				(eventCode === 'arrowup' || eventKey === 'arrowup')
			)
				return true
			if (
				(mainKey === 'down' || mainKey === 'arrowdown') &&
				(eventCode === 'arrowdown' || eventKey === 'arrowdown')
			)
				return true

			return (
				eventKey === mainKey ||
				eventCode === `key${mainKey}` ||
				eventCode === mainKey ||
				eventKey.toUpperCase() === mainKey.toUpperCase()
			)
		}

		const handleLocalKeyDown = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target as HTMLElement)?.isContentEditable
			) {
				return
			}

			// 1. Space 单键独立控制播放/暂停
			if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
				e.preventDefault()
				handleGlobalShortcutAction('play_pause')
				return
			}

			let shortcutsConfig = [
				{ id: 'play_pause', key: 'Ctrl+Alt+Space' },
				{ id: 'prev_track', key: 'Ctrl+Alt+ArrowLeft' },
				{ id: 'next_track', key: 'Ctrl+Alt+ArrowRight' },
			]
			try {
				const saved = localStorage.getItem('bbplayer_shortcuts')
				if (saved) shortcutsConfig = JSON.parse(saved)
			} catch {}

			const playPauseKey = shortcutsConfig.find((s) => s.id === 'play_pause')?.key
			const prevKey = shortcutsConfig.find((s) => s.id === 'prev_track')?.key
			const nextKey = shortcutsConfig.find((s) => s.id === 'next_track')?.key

			if (matchesShortcut(e, playPauseKey)) {
				e.preventDefault()
				handleGlobalShortcutAction('play_pause')
			} else if (matchesShortcut(e, prevKey)) {
				e.preventDefault()
				handleGlobalShortcutAction('prev_track')
			} else if (matchesShortcut(e, nextKey)) {
				e.preventDefault()
				handleGlobalShortcutAction('next_track')
			}
		}

		window.addEventListener('keydown', handleLocalKeyDown)
		return () => window.removeEventListener('keydown', handleLocalKeyDown)
	}, [handleGlobalShortcutAction])

	// 5. Throttled IPC Lyrics Synchronization to Desktop Floating Lyrics Window (with Offset applied)
	// 5. Throttled IPC Lyrics Synchronization to Desktop Floating Lyrics Window (with Offset & Initial Handshake)
	const currentTrackRef = useRef<Track | null>(currentTrack)
	const activeSplContentRef = useRef<string>(activeSplContent)
	useEffect(() => {
		currentTrackRef.current = currentTrack
		activeSplContentRef.current = activeSplContent
	}, [currentTrack, activeSplContent])

	const broadcastFullLyricsState = useCallback(() => {
		const activeTrack =
			desktopAudioEngine.getCurrentTrack() || currentTrackRef.current
		if (!activeTrack) return

		const bili =
			activeTrack.source === 'bilibili' ? (activeTrack as any) : null
		const displayTitle =
			bili?.bilibiliMetadata?.isMultiPage &&
			(bili.bilibiliMetadata.pagePart || bili.bilibiliMetadata.pageIndex)
				? `[P${bili.bilibiliMetadata.pageIndex || 1}] ${
						bili.bilibiliMetadata.pagePart || activeTrack.title
				  }`
				: activeTrack.title

		const offsetSec = getStoredLyricOffset(activeTrack.uniqueKey)
		const now = Date.now()

		emit('lyrics-sync', {
			type: 'TRACK_CHANGE',
			title: displayTitle,
			artist: activeTrack.artist?.name || '未知歌手',
			durationMs: (activeTrack.duration || 0) * 1000,
			splContent: activeSplContentRef.current || undefined,
		}).catch(() => {})

		emit('lyrics-sync', {
			type: 'STATE_SYNC',
			isPlaying: desktopAudioEngine.isPlaying(),
			currentTimeMs: Math.max(
				0,
				(desktopAudioEngine.getCurrentTime() + offsetSec) * 1000,
			),
			timestamp: now,
		}).catch(() => {})
	}, [])

	useEffect(() => {
		let lastSentMs = 0
		let lastPlayState = false
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			const now = Date.now()
			const isPlaying = desktopAudioEngine.isPlaying()
			if (
				event.type === 'trackchange' ||
				isPlaying !== lastPlayState ||
				now - lastSentMs > 200
			) {
				lastSentMs = now
				lastPlayState = isPlaying
				const activeTrack =
					desktopAudioEngine.getCurrentTrack() || currentTrackRef.current
				const offsetSec = activeTrack
					? getStoredLyricOffset(activeTrack.uniqueKey)
					: 0
				emit('lyrics-sync', {
					type: 'STATE_SYNC',
					isPlaying,
					currentTimeMs: Math.max(0, (event.currentTime + offsetSec) * 1000),
					timestamp: now,
				}).catch(() => {})
			}
		})

		// 当桌面歌词窗口被中途打开或主动请求同步时，立即补发全量状态
		let unlistenInitSync: (() => void) | undefined
		listen('lyrics-request-initial-sync', () => {
			broadcastFullLyricsState()
		})
			.then((fn) => {
				unlistenInitSync = fn
			})
			.catch(() => {})

		// 当用户在设置抽屉中微调了歌词时间偏移量，立即同步给桌面歌词
		const handleOffsetImmediate = () => {
			broadcastFullLyricsState()
		}
		window.addEventListener(
			'bbplayer:lyric-offset-change',
			handleOffsetImmediate,
		)

		return () => {
			unsubscribe()
			if (unlistenInitSync) unlistenInitSync()
			window.removeEventListener(
				'bbplayer:lyric-offset-change',
				handleOffsetImmediate,
			)
		}
	}, [broadcastFullLyricsState])

	// Sync Track Info AND SPL Lyrics content to Desktop Floating Lyrics Window
	useEffect(() => {
		broadcastFullLyricsState()
	}, [currentTrack, activeSplContent, broadcastFullLyricsState])

	const handleSearch = (query: string) => {
		if (!query.trim()) return
		setSearchQuery(query)
		setActiveTab('search')
	}

	const handleToggleLyricsWindow = async () => {
		try {
			await invoke('toggle_lyrics_window')
		} catch (err) {
			console.warn('Lyrics window invoke fallback:', err)
		}
	}

	return (
		<>
			<MainLayout
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				onSearch={handleSearch}
				onToggleLyricsWindow={handleToggleLyricsWindow}
				onToggleFullscreenLyrics={() =>
					setFullscreenLyricsOpen(!fullscreenLyricsOpen)
				}
				onOpenLoginModal={() => setLoginModalOpen(true)}
			>
				{(tab) => (
					<div className="h-full flex flex-col space-y-6">
						{tab === 'explore' && (
							<div className="space-y-6">
								{/* Banner Hero */}
								<div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-pink-500/20 via-sky-500/20 to-indigo-500/20 p-8 border border-white/10 backdrop-blur-md">
									<div className="max-w-xl space-y-2">
										<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[11px] font-medium text-sky-300">
											<Sparkles className="w-3.5 h-3.5" />
											<span>Tauri v2 跨平台原生架构</span>
										</div>
										<h1 className="text-2xl font-bold tracking-tight text-white">
											让 B 站成为你的全能高保真音乐库
										</h1>
									</div>
								</div>

								{/* Trending / Recommended Tracks */}
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
											<TrendingUp className="w-4 h-4 text-sky-400" />
											<span>今日精选推荐</span>
										</h2>
										<span className="text-xs text-muted-foreground">
											共 {featuredTracks.length} 首音乐
										</span>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
										{featuredTracks.map((track, idx) => (
											<div
												key={track.id}
												className="group relative rounded-xl p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
											>
												<div
													className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 bg-gradient-to-tr from-sky-950/60 to-purple-950/60 flex items-center justify-center"
													onClick={() => handlePlayTrack(track, idx)}
												>
													<Music className="w-8 h-8 text-white/20 absolute" />
													<img
														src={
															track.coverUrl ||
															'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
														}
														alt={track.title}
														referrerPolicy="no-referrer"
														className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 relative z-0"
														onError={(e) => {
															;(e.currentTarget as HTMLImageElement).style.opacity = '0'
														}}
													/>
													<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
														<div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
															<Play className="w-5 h-5 fill-current ml-0.5" />
														</div>
													</div>
												</div>
												<div className="flex items-center justify-between">
													<div
														className="overflow-hidden flex-1 mr-2"
														onClick={() => handlePlayTrack(track, idx)}
													>
														<p className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
															{track.title}
														</p>
														<p className="text-[11px] text-muted-foreground truncate">
															{track.artist?.name || '未知歌手'}
														</p>
													</div>
													<button
														onClick={(e) => {
															e.stopPropagation()
															setExportModalTrack(track)
														}}
														title="导出为 .m4a"
														className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
													>
														<Download className="w-3.5 h-3.5" />
													</button>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						)}

						{tab === 'search' && (
							<SearchView
								keyword={searchQuery}
								onExportTrack={setExportModalTrack}
							/>
						)}

						{tab === 'library' && (
							<LibraryView
								onOpenImport={() => setPlaylistImportOpen(true)}
								onOpenCreate={() => setCreatePlaylistOpen(true)}
								onExportTrack={setExportModalTrack}
							/>
						)}

						{tab === 'favorites' && (
							<FavoritesView
								onExportTrack={setExportModalTrack}
								onOpenLoginModal={() => setLoginModalOpen(true)}
							/>
						)}

						{tab === 'collections' && (
							<CollectionsView
								onExportTrack={setExportModalTrack}
								onOpenLoginModal={() => setLoginModalOpen(true)}
							/>
						)}

						{tab === 'history' && <HistoryHeatmapView />}

						{tab === 'skins' && <SkinStoreView />}

						{tab === 'settings' && (
							<div className="space-y-4 max-w-xl">
								<h2 className="text-base font-bold text-foreground">
									偏好设置
								</h2>

								{/* Audio Quality Preferences */}
								<AudioQualitySettingsCard />

								{/* Lyrics Preferences */}
								<LyricsSettingsCard />

								{/* Window Close Behavior Card */}
								<div className="rounded-xl bg-white/5 p-4 border border-white/5 text-xs space-y-3">
									<div>
										<p className="font-semibold text-foreground">
											窗口关闭行为
										</p>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
										<button
											onClick={() => {
												setCloseAction('tray')
												localStorage.setItem('bili_player_close_action', 'tray')
												localStorage.setItem('bbplayer_close_action', 'tray')
											}}
											className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
												closeAction === 'tray'
													? 'bg-[#00AEEC]/15 border-[#00AEEC]/40 text-foreground shadow-sm'
													: 'bg-white/[0.02] border-white/5 text-muted-foreground hover:bg-white/5'
											}`}
										>
											<div
												className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
													closeAction === 'tray'
														? 'border-[#00AEEC]'
														: 'border-white/30'
												}`}
											>
												{closeAction === 'tray' && (
													<div className="w-1.5 h-1.5 rounded-full bg-[#00AEEC]" />
												)}
											</div>
											<p
												className={`font-semibold ${
													closeAction === 'tray' ? 'text-[#00AEEC]' : ''
												}`}
											>
												隐藏到系统托盘
											</p>
										</button>

										<button
											onClick={() => {
												setCloseAction('exit')
												localStorage.setItem('bili_player_close_action', 'exit')
												localStorage.setItem('bbplayer_close_action', 'exit')
											}}
											className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
												closeAction === 'exit'
													? 'bg-[#00AEEC]/15 border-[#00AEEC]/40 text-foreground shadow-sm'
													: 'bg-white/[0.02] border-white/5 text-muted-foreground hover:bg-white/5'
											}`}
										>
											<div
												className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
													closeAction === 'exit'
														? 'border-[#00AEEC]'
														: 'border-white/30'
												}`}
											>
												{closeAction === 'exit' && (
													<div className="w-1.5 h-1.5 rounded-full bg-[#00AEEC]" />
												)}
											</div>
											<p
												className={`font-semibold ${
													closeAction === 'exit' ? 'text-[#00AEEC]' : ''
												}`}
											>
												直接关闭应用
											</p>
										</button>
									</div>
								</div>

								<div className="space-y-3 rounded-xl bg-white/5 p-4 border border-white/5 text-xs">
									<div className="flex items-center justify-between">
										<div>
											<p className="font-semibold text-foreground">
												Web Audio 响度均衡
											</p>
											<p className="text-[11px] text-muted-foreground">
												自动根据 B 站音轨响度差值平滑应用 GainNode 动态增益
											</p>
										</div>
										<CheckCircle2 className="w-4 h-4 text-emerald-400" />
									</div>
									<div className="h-px bg-white/5" />
									<div className="flex items-center justify-between">
										<div>
											<p className="font-semibold text-foreground">
												SQLite 数据库状态
											</p>
											<p className="text-[11px] text-muted-foreground">
												{dbReady ? '已连接并完成迁移' : '就绪'}
											</p>
										</div>
										<CheckCircle2 className="w-4 h-4 text-emerald-400" />
									</div>
								</div>

								{/* Customizable Shortcuts Settings */}
								<div className="pt-2">
									<ShortcutsSettingsView />
								</div>
							</div>
						)}
					</div>
				)}
			</MainLayout>

			<LoginModal
				isOpen={loginModalOpen}
				onClose={() => setLoginModalOpen(false)}
			/>

			<PlaylistImportModal
				isOpen={playlistImportOpen}
				onClose={() => setPlaylistImportOpen(false)}
			/>

			<CreatePlaylistModal
				isOpen={createPlaylistOpen}
				onClose={() => setCreatePlaylistOpen(false)}
				onSuccess={() => {
					if (userInfo?.mid) {
						usePlaylistStore.getState().syncRemotePlaylists(userInfo.mid)
					}
				}}
			/>

			<ExportTrackModal
				isOpen={exportModalTrack !== null}
				onClose={() => setExportModalTrack(null)}
				track={exportModalTrack}
			/>

			<ImmersiveLyricsView
				isOpen={fullscreenLyricsOpen}
				onClose={() => setFullscreenLyricsOpen(false)}
				track={currentTrack}
				splContent={activeSplContent}
				isMatching={isMatchingLyrics}
			/>
		</>
	)
}

export default App