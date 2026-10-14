import React, { useState, useEffect } from 'react'
import {
	Search,
	Music,
	Play,
	Plus,
	Heart,
	TrendingUp,
	Disc,
	Sparkles,
	Clock,
	Sliders,
	FolderPlus,
	CheckCircle2,
	Download,
	Import,
} from 'lucide-react'
import { MainLayout } from './components/layout/MainLayout'
import type { NavTab } from './components/layout/Sidebar'
import { LoginModal } from './components/modals/LoginModal'
import { PlaylistImportModal } from './components/modals/PlaylistImportModal'
import { ExportTrackModal } from './components/modals/ExportTrackModal'
import { ImmersiveLyricsView } from './components/player/ImmersiveLyricsView'
import { SkinStoreView } from './components/views/SkinStoreView'
import { HistoryHeatmapView } from './components/views/HistoryHeatmapView'
import { SearchView } from './components/views/SearchView'
import { ShortcutsSettingsView } from './components/views/ShortcutsSettingsView'
import { initDesktopDatabase } from './db/desktopDb'
import {
	useQueueStore,
	useSkinStore,
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

export const App: React.FC = () => {
	const [loginModalOpen, setLoginModalOpen] = useState(false)
	const [playlistImportOpen, setPlaylistImportOpen] = useState(false)
	const [exportModalTrack, setExportModalTrack] = useState<Track | null>(null)
	const [fullscreenLyricsOpen, setFullscreenLyricsOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<NavTab>('explore')
	const [searchQuery, setSearchQuery] = useState('')
	const [dbReady, setDbReady] = useState(false)
	const [featuredTracks, setFeaturedTracks] = useState<Track[]>([
		{
			id: 1,
			uniqueKey: 'bilibili_BV1GJ411x7h7_0',
			title: 'Never Gonna Give You Up',
			artist: dummyArtist(101, 'Rick Astley / 索尼音乐'),
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
			uniqueKey: 'bilibili_BV1Q541167Qg_0',
			title: '夏娜 · 绯色の空 (绯色之空)',
			artist: dummyArtist(102, '川田真美 / 灼眼的夏娜'),
			coverUrl: 'https://i1.hdslb.com/bfs/archive/142397b8ed4c50dceb50a4ed7db18d1d54ab6097.jpg',
			duration: 249,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1Q541167Qg',
				cid: 168409646,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 3,
			uniqueKey: 'bilibili_BV1ab411c7Pn_0',
			title: '千灯愿 (言和原创曲)',
			artist: dummyArtist(103, '言和 / OverseerCouncil'),
			coverUrl: 'https://i0.hdslb.com/bfs/archive/db322e0a56ce7a2434cf52b215af1e783e2478e3.jpg',
			duration: 189,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1ab411c7Pn',
				cid: 62381858,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 4,
			uniqueKey: 'bilibili_BV17x411w7KC_0',
			title: '保加利亚精选合辑 (DJ版)',
			artist: dummyArtist(104, 'AZIS / 妖王'),
			coverUrl: 'https://i2.hdslb.com/bfs/archive/1ada8c32a9d168e4b2ee3e010f24789ba3353785.jpg',
			duration: 2412,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV17x411w7KC',
				cid: 279786,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
	])

	const { setQueue, next, prev, getCurrentTrack } = useQueueStore()
	const currentTrack = getCurrentTrack()

	// 1. Initialize DB
	useEffect(() => {
		initDesktopDatabase()
			.then(() => setDbReady(true))
			.catch((e) => console.warn('Database initialization note:', e))
	}, [])

	// 2. Initialize active theme skin colors
	useEffect(() => {
		const skin = useSkinStore.getState().activeSkinSuit
		const color = skin?.suit_items?.skin?.[0]?.properties?.color
		if (color) {
			document.documentElement.style.setProperty('--primary', color)
			document.documentElement.style.setProperty('--bili-theme-primary', color)
			document.documentElement.style.setProperty('--ring', color)
		}
	}, [])

	// 2.1 Fetch online trending music dynamically on mount
	useEffect(() => {
		const loadTracks = async () => {
			try {
				const res = await bilibiliApi.searchVideos({ keyword: '热门音乐', page: 1 })
				if (res.isOk() && res.value.result && res.value.result.length > 0) {
					const tracks: Track[] = res.value.result.slice(0, 8).map((item, idx) => {
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
					setFeaturedTracks(tracks)
				}
			} catch {}
		}
		loadTracks()
	}, [])

	// 3. Global Shortcuts IPC Event Listener
	useEffect(() => {
		let unlistenFn: (() => void) | undefined
		listen<string>('global-shortcut-event', async (event) => {
			const action = event.payload
			if (action === 'play_pause') {
				if (desktopAudioEngine.isPlaying()) {
					desktopAudioEngine.pause()
				} else {
					desktopAudioEngine.play()
				}
			} else if (action === 'prev_track') {
				const prevTrack = prev()
				if (prevTrack) {
					playTrackWithProxy(prevTrack).catch(() => {})
				}
			} else if (action === 'next_track') {
				const nextTrack = next()
				if (nextTrack) {
					playTrackWithProxy(nextTrack).catch(() => {})
				}
			}
		})
			.then((fn) => {
				unlistenFn = fn
			})
			.catch(() => {})

		return () => {
			if (unlistenFn) unlistenFn()
		}
	}, [next, prev])

	// 4. In-App Single-Key & Global Shortcuts Handling
	useEffect(() => {
		const matchesShortcut = (e: KeyboardEvent, shortcutStr?: string): boolean => {
			if (!shortcutStr) return false
			const parts = shortcutStr.split('+').map((p) => p.trim())
			const mainKey = parts[parts.length - 1].toLowerCase()
			const hasCtrl = parts.some((p) => p.toLowerCase() === 'ctrl')
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
			if (mainKey === 'left' && (eventCode === 'arrowleft' || eventKey === 'arrowleft')) return true
			if (mainKey === 'right' && (eventCode === 'arrowright' || eventKey === 'arrowright')) return true
			if (mainKey === 'up' && (eventCode === 'arrowup' || eventKey === 'arrowup')) return true
			if (mainKey === 'down' && (eventCode === 'arrowdown' || eventKey === 'arrowdown')) return true

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

			let shortcutsConfig = [
				{ id: 'play_pause', key: 'Alt+Shift+Space' },
				{ id: 'prev_track', key: 'Alt+Shift+Left' },
				{ id: 'next_track', key: 'Alt+Shift+Right' },
			]
			try {
				const saved = localStorage.getItem('bbplayer_shortcuts')
				if (saved) shortcutsConfig = JSON.parse(saved)
			} catch {}

			const playPauseKey = shortcutsConfig.find((s) => s.id === 'play_pause')?.key
			const prevKey = shortcutsConfig.find((s) => s.id === 'prev_track')?.key
			const nextKey = shortcutsConfig.find((s) => s.id === 'next_track')?.key

			if (matchesShortcut(e, playPauseKey) || (!playPauseKey && e.code === 'Space')) {
				e.preventDefault()
				if (desktopAudioEngine.isPlaying()) {
					desktopAudioEngine.pause()
				} else {
					desktopAudioEngine.play()
				}
			} else if (matchesShortcut(e, prevKey)) {
				e.preventDefault()
				const prevTrack = prev()
				if (prevTrack) playTrackWithProxy(prevTrack).catch(() => {})
			} else if (matchesShortcut(e, nextKey)) {
				e.preventDefault()
				const nextTrack = next()
				if (nextTrack) playTrackWithProxy(nextTrack).catch(() => {})
			}
		}

		window.addEventListener('keydown', handleLocalKeyDown)
		return () => window.removeEventListener('keydown', handleLocalKeyDown)
	}, [next, prev])

	// 4. IPC Lyrics Synchronization to Desktop Floating Lyrics Window
	useEffect(() => {
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			emit('lyrics-sync', {
				type: 'STATE_SYNC',
				isPlaying: desktopAudioEngine.isPlaying(),
				currentTimeMs: event.currentTime * 1000,
				timestamp: Date.now(),
			}).catch(() => {})
		})
		return unsubscribe
	}, [])

	useEffect(() => {
		if (currentTrack) {
			emit('lyrics-sync', {
				type: 'TRACK_CHANGE',
				title: currentTrack.title,
				artist: currentTrack.artist?.name || '未知歌手',
				durationMs: (currentTrack.duration || 0) * 1000,
			}).catch(() => {})
		}
	}, [currentTrack])

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

	const handlePlayTrack = async (track: Track, index: number) => {
		setQueue(featuredTracks, index)
		try {
			await playTrackWithProxy(track)
		} catch (err) {
			console.error('Failed to play track with proxy:', err)
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
										<p className="text-xs text-muted-foreground leading-relaxed">
											原生 Mica 毛玻璃材质、独立穿透桌面歌词、Web Audio 响度均衡防爆音、本地流媒体无损缓存与纯 Rust 格式导出。
										</p>
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
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h2 className="text-base font-bold text-foreground">
										我的音乐库
									</h2>
									<div className="flex items-center gap-2">
										<button
											onClick={() => setPlaylistImportOpen(true)}
											className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-medium transition-colors"
										>
											<Import className="w-3.5 h-3.5" />
											<span>导入网易云/QQ歌单</span>
										</button>
										<button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors">
											<FolderPlus className="w-3.5 h-3.5" />
											<span>新建歌单</span>
										</button>
									</div>
								</div>
								<div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-muted-foreground text-xs">
									暂无自定义歌单，可点击上方“导入网易云/QQ歌单”快速迁移
								</div>
							</div>
						)}

						{tab === 'favorites' && (
							<div className="space-y-4">
								<h2 className="text-base font-bold text-foreground">
									我喜欢的音乐
								</h2>
								<div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-muted-foreground text-xs">
									登录 B 站账号后将自动同步你收藏的音频与视频
								</div>
							</div>
						)}

						{tab === 'history' && <HistoryHeatmapView />}

						{tab === 'skins' && <SkinStoreView />}

						{tab === 'settings' && (
							<div className="space-y-4 max-w-xl">
								<h2 className="text-base font-bold text-foreground">
									偏好设置
								</h2>
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

			<ExportTrackModal
				isOpen={exportModalTrack !== null}
				onClose={() => setExportModalTrack(null)}
				track={exportModalTrack}
			/>

			<ImmersiveLyricsView
				isOpen={fullscreenLyricsOpen}
				onClose={() => setFullscreenLyricsOpen(false)}
				track={currentTrack}
			/>
		</>
	)
}

export default App
