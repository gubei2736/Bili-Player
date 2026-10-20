import React, { useState, useEffect } from 'react'
import {
	Heart,
	Play,
	RefreshCw,
	Download,
	Clock,
	User,
	FolderHeart,
	Sparkles,
	LogIn,
	Music,
	Loader2,
	EyeOff,
	Eye,
	SlidersHorizontal,
	X,
	Check,
	Search,
} from 'lucide-react'
import {
	useAuthStore,
	usePlaylistStore,
	useQueueStore,
	useCurrentTrack,
	bilibiliApi,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'
import { convertFavoriteItemToTrack, formatDuration } from '../../utils/trackConverter'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import {
	getHiddenFavoriteIds,
	toggleHideFavorite,
	setHiddenFavoriteIds,
} from '../../utils/filterSettings'

export interface FavoritesViewProps {
	onExportTrack?: (track: Track) => void
	onOpenLoginModal?: () => void
	onBatchExport?: (title: string, tracks: Track[]) => void
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
	onExportTrack,
	onOpenLoginModal,
	onBatchExport,
}) => {
	const { isLoggedIn, userInfo } = useAuthStore()
	const {
		favoritePlaylists,
		selectedPlaylistId,
		setSelectedPlaylistId,
		syncRemotePlaylists,
		playlistTracksCache,
		setPlaylistTracksCache,
		isLoading: isSyncingPlaylists,
	} = usePlaylistStore()
	const { setQueue } = useQueueStore()
	const currentTrack = useCurrentTrack()

	const [tracks, setTracks] = useState<BilibiliTrack[]>(() => {
		if (selectedPlaylistId && playlistTracksCache[selectedPlaylistId]) {
			return playlistTracksCache[selectedPlaylistId]!
		}
		return []
	})
	const [searchKeyword, setSearchKeyword] = useState('')
	const [loadingTracks, setLoadingTracks] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [hiddenIds, setHiddenIds] = useState<number[]>(getHiddenFavoriteIds())
	const [showManageModal, setShowManageModal] = useState(false)

	const filteredTracks = tracks.filter((t) => {
		if (!searchKeyword.trim()) return true
		const kw = searchKeyword.toLowerCase().trim()
		return (
			t.title.toLowerCase().includes(kw) ||
			(t.artist?.name || '').toLowerCase().includes(kw) ||
			(t.bilibiliMetadata?.bvid || '').toLowerCase().includes(kw)
		)
	})

	// Listen for hidden favorites change
	useEffect(() => {
		const handleFilterChange = (e: any) => {
			setHiddenIds(e.detail || getHiddenFavoriteIds())
		}
		window.addEventListener('bbplayer:hidden-favorites-change', handleFilterChange)
		return () => {
			window.removeEventListener('bbplayer:hidden-favorites-change', handleFilterChange)
		}
	}, [])

	// Filter visible playlists
	const visiblePlaylists = favoritePlaylists.filter(
		(p) => !hiddenIds.includes(p.id),
	)

	// Fetch tracks when selectedPlaylistId changes (cache-first)
	const fetchPlaylistTracks = async (favoriteId: number, forceRefresh = false) => {
		const cached = playlistTracksCache[favoriteId]
		if (cached && cached.length > 0 && !forceRefresh) {
			setTracks(cached)
			setLoadingTracks(false)
			return
		}

		setLoadingTracks(true)
		setError(null)
		try {
			const res = await bilibiliApi.getFavoriteListContents({
				favoriteId,
				pn: 1,
			})
			if (res.isOk()) {
				const medias = res.value.medias || []
				const converted = medias.map((m, idx) =>
					convertFavoriteItemToTrack(m, idx),
				)
				setTracks(converted)
				setPlaylistTracksCache(favoriteId, converted)
			} else {
				setError(res.error.message || '获取收藏夹内容失败')
				if (!cached) setTracks([])
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '网络请求异常')
			if (!cached) setTracks([])
		} finally {
			setLoadingTracks(false)
		}
	}

	useEffect(() => {
		// If current selected is hidden, auto select first visible
		if (selectedPlaylistId && hiddenIds.includes(selectedPlaylistId)) {
			if (visiblePlaylists.length > 0 && visiblePlaylists[0]) {
				setSelectedPlaylistId(visiblePlaylists[0].id)
			} else {
				setSelectedPlaylistId(null)
			}
			return
		}

		if (selectedPlaylistId) {
			fetchPlaylistTracks(selectedPlaylistId)
		} else if (visiblePlaylists.length > 0 && visiblePlaylists[0]) {
			setSelectedPlaylistId(visiblePlaylists[0].id)
		}
	}, [selectedPlaylistId, favoritePlaylists, hiddenIds])

	const handleRefresh = async () => {
		if (!userInfo?.mid) return
		await syncRemotePlaylists(userInfo.mid)
		if (selectedPlaylistId) {
			await fetchPlaylistTracks(selectedPlaylistId, true)
		}
	}

	const handlePlayAll = async () => {
		if (filteredTracks.length === 0) return
		setQueue(filteredTracks, 0)
		try {
			await playTrackWithProxy(filteredTracks[0]!)
		} catch (err) {
			console.error('Failed to play all:', err)
		}
	}

	const handlePlayTrack = async (track: BilibiliTrack, index: number) => {
		setQueue(filteredTracks, index)
		try {
			await playTrackWithProxy(track)
		} catch (err) {
			console.error('Failed to play track:', err)
		}
	}

	const handleToggleHide = (id: number, e?: React.MouseEvent) => {
		e?.stopPropagation()
		toggleHideFavorite(id)
	}

	const handleUnhideAll = () => {
		setHiddenFavoriteIds([])
	}

	if (!isLoggedIn) {
		return (
			<div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
				<div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-pink-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
					<Heart className="w-8 h-8 fill-current" />
				</div>
				<div className="max-w-md space-y-2">
					<h3 className="text-base font-bold text-foreground">
						登录 B 站账号同步收藏夹
					</h3>
					<p className="text-xs text-muted-foreground leading-relaxed">
						登录后即可查看你在 B 站创建的默认收藏夹与全部自定义歌单，随时随地畅听你收藏的优质曲目。
					</p>
				</div>
				{onOpenLoginModal && (
					<button
						onClick={onOpenLoginModal}
						className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 transition-all duration-200"
					>
						<LogIn className="w-4 h-4" />
						<span>立即扫码登录</span>
					</button>
				)}
			</div>
		)
	}

	const currentPlaylist = favoritePlaylists.find(
		(p) => p.id === selectedPlaylistId,
	)

	return (
		<div className="space-y-6">
			{/* Top Bar: Title & Actions */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
						<Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
						<span>我的收藏</span>
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						已关联 B 站账号，实时同步你的个人收藏夹与音乐列表
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2.5">
					{/* Search Bar in Favorites */}
					{tracks.length > 0 && (
						<div className="relative w-40 sm:w-56">
							<Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
							<input
								type="text"
								placeholder="搜索当前收藏歌曲/UP主..."
								value={searchKeyword}
								onChange={(e) => setSearchKeyword(e.target.value)}
								className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
							/>
							{searchKeyword && (
								<button
									onClick={() => setSearchKeyword('')}
									className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
								>
									<X className="w-3.5 h-3.5" />
								</button>
							)}
						</div>
					)}

					<button
						onClick={() => setShowManageModal(true)}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-foreground transition-all duration-150"
						title="管理或隐藏非音乐收藏夹"
					>
						<SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
						<span>过滤</span>
						{hiddenIds.length > 0 && (
							<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-semibold">
								已隐藏 {hiddenIds.length}
							</span>
						)}
					</button>

					<button
						onClick={handleRefresh}
						disabled={isSyncingPlaylists || loadingTracks}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-foreground transition-all duration-150 disabled:opacity-50"
					>
						<RefreshCw
							className={`w-3.5 h-3.5 ${
								isSyncingPlaylists || loadingTracks ? 'animate-spin' : ''
							}`}
						/>
						<span>刷新</span>
					</button>

					{filteredTracks.length > 0 && (
						<>
							<button
								onClick={handlePlayAll}
								className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-all duration-150"
							>
								<Play className="w-3.5 h-3.5 fill-current" />
								<span>播放全部</span>
							</button>
							<button
								onClick={() => {
									const activePl = favoritePlaylists.find((p) => p.id === selectedPlaylistId)
									const pTitle = activePl ? activePl.title : '我的收藏'
									onBatchExport?.(pTitle, tracks)
								}}
								className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-foreground transition-all duration-150"
								title="批量下载当前收藏夹歌曲（支持大会员最高规格）"
							>
								<Download className="w-3.5 h-3.5 text-sky-400" />
								<span>批量下载</span>
							</button>
						</>
					)}
				</div>
			</div>

			{/* Playlist Tabs / Selector */}
			{visiblePlaylists.length > 0 ? (
				<div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
					{visiblePlaylists.map((pl) => {
						const isSelected = pl.id === selectedPlaylistId
						return (
							<div
								key={pl.id}
								className={`group/tab relative flex items-center rounded-xl border transition-all duration-150 ${
									isSelected
										? 'bg-primary/20 border-primary/40 text-primary font-semibold shadow-sm'
										: 'bg-white/5 border-white/5 text-foreground/75 hover:bg-white/10 hover:text-foreground'
								}`}
							>
								<button
									onClick={() => {
										setSelectedPlaylistId(pl.id)
										setSearchKeyword('')
									}}
									className="px-3.5 py-1.5 text-xs font-medium whitespace-nowrap flex items-center gap-2"
								>
									<FolderHeart className="w-3.5 h-3.5" />
									<span>{pl.title}</span>
									<span className="text-[10px] opacity-60">({pl.media_count})</span>
								</button>
								<button
									onClick={(e) => handleToggleHide(pl.id, e)}
									title="隐藏此收藏夹"
									className="pr-2 opacity-0 group-hover/tab:opacity-100 hover:text-red-400 transition-opacity"
								>
									<EyeOff className="w-3 h-3" />
								</button>
							</div>
						)
					})}
				</div>
			) : (
				<div className="p-6 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-2">
					<p className="text-xs">所有收藏夹均已隐藏</p>
					<button
						onClick={handleUnhideAll}
						className="text-xs text-primary hover:underline font-medium"
					>
						恢复显示全部收藏夹
					</button>
				</div>
			)}

			{/* Tracks Content Area */}
			{loadingTracks ? (
				<div className="h-48 flex flex-col items-center justify-center space-y-3">
					<Loader2 className="w-6 h-6 animate-spin text-primary" />
					<p className="text-xs text-muted-foreground">正在加载收藏夹曲目...</p>
				</div>
			) : error ? (
				<div className="p-8 text-center rounded-xl border border-dashed border-red-500/20 bg-red-500/5 text-red-400 text-xs">
					{error}
				</div>
			) : tracks.length === 0 ? (
				<div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-3">
					<FolderHeart className="w-10 h-10 mx-auto opacity-30" />
					<p className="text-xs">
						当前收藏夹暂无音频内容，去 B 站将喜欢的音乐收藏到该收藏夹吧
					</p>
				</div>
			) : filteredTracks.length === 0 ? (
				<div className="p-14 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-2">
					<Search className="w-8 h-8 mx-auto opacity-30 text-primary" />
					<p className="text-sm font-semibold text-foreground/80">未找到匹配歌曲</p>
					<p className="text-xs text-muted-foreground">
						当前收藏夹没有找到与 “{searchKeyword}” 相关的歌曲或UP主
					</p>
					<button
						onClick={() => setSearchKeyword('')}
						className="text-xs text-primary hover:underline mt-2 inline-block font-medium"
					>
						清空搜索关键词
					</button>
				</div>
			) : (
				<div className="space-y-1 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
					<div className="grid grid-cols-12 px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-white/5">
						<span className="col-span-1 text-center">#</span>
						<span className="col-span-7">
							歌曲标题 {searchKeyword.trim() && `(匹配 ${filteredTracks.length} / 共 ${tracks.length} 首)`}
						</span>
						<span className="col-span-2">UP主</span>
						<span className="col-span-2 text-right">时长 / 操作</span>
					</div>

					<div className="divide-y divide-white/[0.03]">
						{filteredTracks.map((track, idx) => {
							const isCurrentPlaying = currentTrack?.uniqueKey === track.uniqueKey
							return (
								<div
									key={track.uniqueKey}
									onClick={() => handlePlayTrack(track, idx)}
									className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group ${
										isCurrentPlaying ? 'bg-primary/10 text-primary' : 'text-foreground'
									}`}
								>
									{/* Index / Play indicator */}
									<div className="col-span-1 flex items-center justify-center text-xs text-muted-foreground">
										{isCurrentPlaying ? (
											<span className="text-primary text-xs animate-pulse">▶</span>
										) : (
											<span className="group-hover:hidden">{idx + 1}</span>
										)}
										<Play className="w-3.5 h-3.5 fill-current hidden group-hover:block text-foreground" />
									</div>

									{/* Title & Cover */}
									<div className="col-span-7 flex items-center gap-3 overflow-hidden pr-2">
										<img
											src={track.coverUrl || undefined}
											alt={track.title}
											referrerPolicy="no-referrer"
											className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/10"
											onError={(e) => {
												;(e.currentTarget as HTMLImageElement).style.opacity = '0'
											}}
										/>
										<div className="overflow-hidden">
											<p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
												{track.title}
											</p>
											<p className="text-[10px] text-muted-foreground truncate">
												BV: {track.bilibiliMetadata.bvid}
											</p>
										</div>
									</div>

									{/* Author */}
									<div className="col-span-2 text-xs text-muted-foreground truncate">
										{track.artist?.name || '未知UP主'}
									</div>

									{/* Duration & Export */}
									<div className="col-span-2 flex items-center justify-end gap-3 text-xs text-muted-foreground">
										<span>{formatDuration(track.duration)}</span>
										<button
											onClick={(e) => {
												e.stopPropagation()
												onExportTrack?.(track)
											}}
											title="导出为 .m4a"
											className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
										>
											<Download className="w-3.5 h-3.5" />
										</button>
									</div>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Modal: Favorite Visibility Management */}
			{showManageModal && (
				<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-background/95 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<SlidersHorizontal className="w-4 h-4 text-primary" />
								<h3 className="font-bold text-sm text-foreground">
									收藏夹显示与隐藏设置
								</h3>
							</div>
							<button
								onClick={() => setShowManageModal(false)}
								className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						<p className="text-xs text-muted-foreground leading-relaxed">
							针对非音乐类收藏夹（如知识合辑、生活日常），可点击右侧眼睛图标隐藏，隐藏后在播放器列表中不予显示。
						</p>

						<div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
							{favoritePlaylists.map((pl) => {
								const isHidden = hiddenIds.includes(pl.id)
								return (
									<div
										key={pl.id}
										onClick={() => handleToggleHide(pl.id)}
										className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
											isHidden
												? 'bg-white/[0.01] border-white/5 opacity-50'
												: 'bg-white/5 border-white/10 hover:bg-white/10'
										}`}
									>
										<div className="flex items-center gap-2.5 overflow-hidden">
											<FolderHeart
												className={`w-4 h-4 ${
													isHidden ? 'text-muted-foreground' : 'text-primary'
												}`}
											/>
											<span className="text-xs font-medium truncate text-foreground">
												{pl.title}
											</span>
											<span className="text-[10px] text-muted-foreground">
												({pl.media_count} 首)
											</span>
										</div>

										<button
											onClick={(e) => handleToggleHide(pl.id, e)}
											className={`p-1.5 rounded-lg transition-colors ${
												isHidden
													? 'text-muted-foreground hover:text-foreground'
													: 'text-primary hover:bg-primary/10'
											}`}
											title={isHidden ? '点击显示' : '点击隐藏'}
										>
											{isHidden ? (
												<EyeOff className="w-4 h-4" />
											) : (
												<Eye className="w-4 h-4" />
											)}
										</button>
									</div>
								)
							})}
						</div>

						<div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
							<button
								onClick={handleUnhideAll}
								className="text-muted-foreground hover:text-primary transition-colors text-xs"
							>
								恢复全部显示
							</button>
							<button
								onClick={() => setShowManageModal(false)}
								className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow transition-colors"
							>
								完成
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
