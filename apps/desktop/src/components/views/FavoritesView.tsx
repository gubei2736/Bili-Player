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
} from 'lucide-react'
import {
	useAuthStore,
	usePlaylistStore,
	useQueueStore,
	bilibiliApi,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'
import { convertFavoriteItemToTrack, formatDuration } from '../../utils/trackConverter'
import { playTrackWithProxy } from '../../audio/playTrackHelper'

export interface FavoritesViewProps {
	onExportTrack?: (track: Track) => void
	onOpenLoginModal?: () => void
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
	onExportTrack,
	onOpenLoginModal,
}) => {
	const { isLoggedIn, userInfo } = useAuthStore()
	const {
		favoritePlaylists,
		selectedPlaylistId,
		setSelectedPlaylistId,
		syncRemotePlaylists,
		isLoading: isSyncingPlaylists,
	} = usePlaylistStore()
	const { setQueue, getCurrentTrack } = useQueueStore()
	const currentTrack = getCurrentTrack()

	const [tracks, setTracks] = useState<BilibiliTrack[]>([])
	const [loadingTracks, setLoadingTracks] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Fetch tracks when selectedPlaylistId changes
	const fetchPlaylistTracks = async (favoriteId: number) => {
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
			} else {
				setError(res.error.message || '获取收藏夹内容失败')
				setTracks([])
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '网络请求异常')
			setTracks([])
		} finally {
			setLoadingTracks(false)
		}
	}

	useEffect(() => {
		if (selectedPlaylistId) {
			fetchPlaylistTracks(selectedPlaylistId)
		} else if (favoritePlaylists.length > 0 && favoritePlaylists[0]) {
			setSelectedPlaylistId(favoritePlaylists[0].id)
		}
	}, [selectedPlaylistId, favoritePlaylists])

	const handleRefresh = async () => {
		if (!userInfo?.mid) return
		await syncRemotePlaylists(userInfo.mid)
		if (selectedPlaylistId) {
			await fetchPlaylistTracks(selectedPlaylistId)
		}
	}

	const handlePlayAll = async () => {
		if (tracks.length === 0) return
		setQueue(tracks, 0)
		try {
			await playTrackWithProxy(tracks[0]!)
		} catch (err) {
			console.error('Failed to play all:', err)
		}
	}

	const handlePlayTrack = async (track: BilibiliTrack, index: number) => {
		setQueue(tracks, index)
		try {
			await playTrackWithProxy(track)
		} catch (err) {
			console.error('Failed to play track:', err)
		}
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
						<span>我喜欢的音乐</span>
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						已关联 B 站账号，实时同步你的个人收藏夹与音乐列表
					</p>
				</div>

				<div className="flex items-center gap-2.5">
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
						<span>刷新同步</span>
					</button>

					{tracks.length > 0 && (
						<button
							onClick={handlePlayAll}
							className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-all duration-150"
						>
							<Play className="w-3.5 h-3.5 fill-current" />
							<span>播放全部 ({tracks.length})</span>
						</button>
					)}
				</div>
			</div>

			{/* Playlist Tabs / Selector */}
			{favoritePlaylists.length > 0 && (
				<div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
					{favoritePlaylists.map((pl) => {
						const isSelected = pl.id === selectedPlaylistId
						return (
							<button
								key={pl.id}
								onClick={() => setSelectedPlaylistId(pl.id)}
								className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 flex items-center gap-2 border ${
									isSelected
										? 'bg-primary/20 border-primary/40 text-primary font-semibold shadow-sm'
										: 'bg-white/5 border-white/5 text-foreground/75 hover:bg-white/10 hover:text-foreground'
								}`}
							>
								<FolderHeart className="w-3.5 h-3.5" />
								<span>{pl.title}</span>
								<span className="text-[10px] opacity-60">({pl.media_count})</span>
							</button>
						)
					})}
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
			) : (
				<div className="space-y-1 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
					<div className="grid grid-cols-12 px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-white/5">
						<span className="col-span-1 text-center">#</span>
						<span className="col-span-7">歌曲标题</span>
						<span className="col-span-2">UP主</span>
						<span className="col-span-2 text-right">时长 / 操作</span>
					</div>

					<div className="divide-y divide-white/[0.03]">
						{tracks.map((track, idx) => {
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
		</div>
	)
}
