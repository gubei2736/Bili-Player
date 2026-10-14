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
import { initDesktopDatabase } from './db/desktopDb'
import {
	useQueueStore,
	useSkinStore,
	type Track,
	type Artist,
} from '@bbplayer/shared-core'
import { desktopAudioEngine } from './audio/DesktopAudioEngine'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

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
	const [featuredTracks] = useState<Track[]>([
		{
			id: 1,
			uniqueKey: 'bilibili_BV1sb411A7t4_0',
			title: '勾指起誓',
			artist: dummyArtist(101, '洛天依 / ilem'),
			coverUrl: 'https://i0.hdslb.com/bfs/archive/c44458514197c36a4ee04d27e997f3b89fa5a939.jpg',
			duration: 228,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1sb411A7t4',
				cid: null,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 2,
			uniqueKey: 'bilibili_BV14s411V78B_0',
			title: '普通 DISCO',
			artist: dummyArtist(101, '洛天依 / 言和 / ilem'),
			coverUrl: 'https://i0.hdslb.com/bfs/archive/4784e27f6735e5d3fcbafe72f6a73c1d4715fbc7.jpg',
			duration: 214,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV14s411V78B',
				cid: null,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 3,
			uniqueKey: 'bilibili_BV1es411874b_0',
			title: '达拉崩吧',
			artist: dummyArtist(101, '洛天依 / 言和 / ilem'),
			coverUrl: 'https://i0.hdslb.com/bfs/archive/aa07c2937ee2e74211116c27fba2e4a66bb62eec.jpg',
			duration: 224,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1es411874b',
				cid: null,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 4,
			uniqueKey: 'bilibili_BV1xx411c7mD_0',
			title: '万神纪',
			artist: dummyArtist(102, '肥皂菌 / 墨明棋妙'),
			coverUrl: 'https://i0.hdslb.com/bfs/archive/f764a8837eec52857e4e1a0df47285bf87da3ee7.jpg',
			duration: 279,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1xx411c7mD',
				cid: null,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
	])

	const { setQueue, getCurrentTrack } = useQueueStore()
	const currentTrack = getCurrentTrack()

	useEffect(() => {
		initDesktopDatabase()
			.then(() => setDbReady(true))
			.catch((e) => console.warn('Database initialization note:', e))
	}, [])

	// IPC Lyrics Synchronization to Desktop Floating Lyrics Window
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
		setSearchQuery(query)
		console.log('Search triggered:', query)
	}

	const handleToggleLyricsWindow = async () => {
		try {
			await invoke('toggle_lyrics_window')
		} catch (err) {
			console.warn('Lyrics window invoke fallback:', err)
		}
	}

	const handlePlayTrack = (track: Track, index: number) => {
		setQueue(featuredTracks, index)
	}

	return (
		<>
			<MainLayout
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
													className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 bg-black/40"
													onClick={() => handlePlayTrack(track, idx)}
												>
													<img
														src={
															track.coverUrl ||
															'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
														}
														alt={track.title}
														className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
													/>
													<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
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
