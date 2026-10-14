import React, { useState, useEffect } from 'react'
import {
	FolderHeart,
	Play,
	RefreshCw,
	Download,
	Clock,
	User,
	Layers,
	Sparkles,
	LogIn,
	Music,
	Loader2,
	ChevronRight,
	ArrowLeft,
} from 'lucide-react'
import {
	useAuthStore,
	usePlaylistStore,
	useQueueStore,
	bilibiliApi,
	type Track,
	type BilibiliTrack,
	type BilibiliCollection,
} from '@bbplayer/shared-core'
import {
	convertCollectionMediaToTrack,
	formatDuration,
	formatCoverUrl,
} from '../../utils/trackConverter'
import { playTrackWithProxy } from '../../audio/playTrackHelper'

export interface CollectionsViewProps {
	onExportTrack?: (track: Track) => void
	onOpenLoginModal?: () => void
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
	onExportTrack,
	onOpenLoginModal,
}) => {
	const { isLoggedIn, userInfo } = useAuthStore()
	const {
		collections,
		syncRemotePlaylists,
		isLoading: isSyncing,
	} = usePlaylistStore()
	const { setQueue, getCurrentTrack } = useQueueStore()
	const currentTrack = getCurrentTrack()

	const [activeCollection, setActiveCollection] =
		useState<BilibiliCollection | null>(null)
	const [tracks, setTracks] = useState<BilibiliTrack[]>([])
	const [loadingTracks, setLoadingTracks] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Fetch tracks when an activeCollection is selected
	const fetchCollectionTracks = async (col: BilibiliCollection) => {
		setLoadingTracks(true)
		setError(null)
		try {
			const res = await bilibiliApi.getCollectionAllContents({
				collectionId: col.id,
			})
			if (res.isOk()) {
				const medias = res.value.medias || []
				const converted = medias.map((m, idx) =>
					convertCollectionMediaToTrack(m, idx),
				)
				setTracks(converted)
			} else {
				// Fallback to series archives if not a season collection
				const seriesRes = await bilibiliApi.getSeriesArchivesPage({
					seriesId: col.id,
					mid: col.upper?.mid || userInfo?.mid || 0,
					pageNumber: 1,
					pageSize: 50,
				})
				if (seriesRes.isOk()) {
					const archives = seriesRes.value.archives || []
					const converted: BilibiliTrack[] = archives.map((a, idx) => ({
						id: a.aid || idx + 1,
						uniqueKey: `bilibili_${a.bvid}_0`,
						title: a.title,
						artist: {
							id: a.upMid || col.upper?.mid || 0,
							name: col.upper?.name || '未知UP主',
							source: 'bilibili',
							createdAt: new Date(),
							updatedAt: new Date(),
						},
						coverUrl: formatCoverUrl(a.pic),
						duration: a.duration || 180,
						source: 'bilibili',
						createdAt: new Date(a.pubdate ? a.pubdate * 1000 : Date.now()),
						updatedAt: new Date(),
						bilibiliMetadata: {
							bvid: a.bvid,
							cid: null,
							isMultiPage: false,
							videoIsValid: true,
						},
					}))
					setTracks(converted)
				} else {
					setError('获取合集内容失败，可能是私有或已下架')
					setTracks([])
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '网络请求异常')
			setTracks([])
		} finally {
			setLoadingTracks(false)
		}
	}

	const handleSelectCollection = (col: BilibiliCollection) => {
		setActiveCollection(col)
		fetchCollectionTracks(col)
	}

	const handleRefresh = async () => {
		if (!userInfo?.mid) return
		await syncRemotePlaylists(userInfo.mid)
		if (activeCollection) {
			await fetchCollectionTracks(activeCollection)
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
				<div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
					<FolderHeart className="w-8 h-8" />
				</div>
				<div className="max-w-md space-y-2">
					<h3 className="text-base font-bold text-foreground">
						登录 B 站账号查看追更合集
					</h3>
					<p className="text-xs text-muted-foreground leading-relaxed">
						自动同步你在 B 站收藏和追更的专栏/视频合集与系列，新曲更新第一时间收听。
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

	return (
		<div className="space-y-6">
			{/* Top Bar */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					{activeCollection && (
						<button
							onClick={() => setActiveCollection(null)}
							className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-foreground transition-colors"
							title="返回合集列表"
						>
							<ArrowLeft className="w-4 h-4" />
						</button>
					)}
					<div>
						<h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
							<Layers className="w-5 h-5 text-sky-400" />
							<span>{activeCollection ? activeCollection.title : '追更合集'}</span>
						</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							{activeCollection
								? `UP主: ${activeCollection.upper?.name || '未知'} · 共 ${
										tracks.length || activeCollection.media_count
								  } 个视频曲目`
								: '已同步你在 B 站收藏的所有合集与系列'}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2.5">
					<button
						onClick={handleRefresh}
						disabled={isSyncing || loadingTracks}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-foreground transition-all duration-150 disabled:opacity-50"
					>
						<RefreshCw
							className={`w-3.5 h-3.5 ${
								isSyncing || loadingTracks ? 'animate-spin' : ''
							}`}
						/>
						<span>刷新同步</span>
					</button>

					{activeCollection && tracks.length > 0 && (
						<button
							onClick={handlePlayAll}
							className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-all duration-150"
						>
							<Play className="w-3.5 h-3.5 fill-current" />
							<span>播放合集 ({tracks.length})</span>
						</button>
					)}
				</div>
			</div>

			{/* View 1: Collections Cards Grid */}
			{!activeCollection && (
				<>
					{collections.length === 0 ? (
						<div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-3">
							<FolderHeart className="w-10 h-10 mx-auto opacity-30" />
							<p className="text-xs">
								暂无订阅合集，在 B 站收藏喜爱的视频合集后点击右上角“刷新同步”
							</p>
						</div>
					) : (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{collections.map((col) => (
								<div
									key={col.id}
									onClick={() => handleSelectCollection(col)}
									className="group rounded-xl p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
								>
									<div className="relative w-full aspect-video rounded-lg overflow-hidden mb-2.5 bg-gradient-to-tr from-sky-950/60 to-purple-950/60 flex items-center justify-center">
										<img
											src={formatCoverUrl(col.cover)}
											alt={col.title}
											referrerPolicy="no-referrer"
											className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
											onError={(e) => {
												;(e.currentTarget as HTMLImageElement).style.opacity = '0'
											}}
										/>
										<div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white backdrop-blur-sm">
											{col.media_count} P
										</div>
										<div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
											<ChevronRight className="w-6 h-6 text-white" />
										</div>
									</div>

									<div>
										<p className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
											{col.title}
										</p>
										<p className="text-[11px] text-muted-foreground truncate mt-0.5">
											{col.upper?.name || '未知UP主'}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</>
			)}

			{/* View 2: Collection Tracks List */}
			{activeCollection && (
				<div>
					{loadingTracks ? (
						<div className="h-48 flex flex-col items-center justify-center space-y-3">
							<Loader2 className="w-6 h-6 animate-spin text-primary" />
							<p className="text-xs text-muted-foreground">正在加载合集曲目...</p>
						</div>
					) : error ? (
						<div className="p-8 text-center rounded-xl border border-dashed border-red-500/20 bg-red-500/5 text-red-400 text-xs">
							{error}
						</div>
					) : tracks.length === 0 ? (
						<div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-3">
							<p className="text-xs">该合集内暂无视频音频内容</p>
						</div>
					) : (
						<div className="space-y-1 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
							<div className="grid grid-cols-12 px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-white/5">
								<span className="col-span-1 text-center">#</span>
								<span className="col-span-7">标题</span>
								<span className="col-span-2">UP主</span>
								<span className="col-span-2 text-right">时长 / 操作</span>
							</div>

							<div className="divide-y divide-white/[0.03]">
								{tracks.map((track, idx) => {
									const isCurrentPlaying =
										currentTrack?.uniqueKey === track.uniqueKey
									return (
										<div
											key={track.uniqueKey}
											onClick={() => handlePlayTrack(track, idx)}
											className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group ${
												isCurrentPlaying
													? 'bg-primary/10 text-primary'
													: 'text-foreground'
											}`}
										>
											<div className="col-span-1 flex items-center justify-center text-xs text-muted-foreground">
												{isCurrentPlaying ? (
													<span className="text-primary text-xs animate-pulse">
														▶
													</span>
												) : (
													<span className="group-hover:hidden">{idx + 1}</span>
												)}
												<Play className="w-3.5 h-3.5 fill-current hidden group-hover:block text-foreground" />
											</div>

											<div className="col-span-7 flex items-center gap-3 overflow-hidden pr-2">
												<img
													src={track.coverUrl || undefined}
													alt={track.title}
													referrerPolicy="no-referrer"
													className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/10"
													onError={(e) => {
														;(e.currentTarget as HTMLImageElement).style.opacity =
															'0'
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

											<div className="col-span-2 text-xs text-muted-foreground truncate">
												{track.artist?.name || '未知UP主'}
											</div>

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
			)}
		</div>
	)
}
