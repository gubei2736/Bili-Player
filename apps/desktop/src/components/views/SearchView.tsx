import React, { useState, useEffect } from 'react'
import {
	Search,
	Play,
	Clock,
	User,
	Download,
	Sparkles,
	AlertCircle,
	Loader2,
	FolderPlus,
	Layers,
	ArrowLeft,
	ListMusic,
	ChevronLeft,
	ChevronRight,
	FolderHeart,
	Music,
	CheckCircle2,
} from 'lucide-react'
import {
	bilibiliApi,
	type BilibiliSearchVideo,
	type BilibiliSearchUser,
	type BilibiliSeasonItem,
	type BilibiliSeriesItem,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import { useQueueStore } from '@bbplayer/shared-core'
import { AddToPlaylistModal } from '../modals/AddToPlaylistModal'
import { VideoPartsModal } from '../modals/VideoPartsModal'

export interface SearchViewProps {
	keyword: string
	mode?: 'video' | 'up'
	onModeChange?: (mode: 'video' | 'up') => void
	onExportTrack?: (track: Track) => void
}

function parseDurationSeconds(durationStr: string): number {
	if (!durationStr) return 180
	const parts = durationStr.split(':').map((p) => parseInt(p, 10))
	if (parts.length === 2) {
		return (parts[0] || 0) * 60 + (parts[1] || 0)
	} else if (parts.length === 3) {
		return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
	}
	return parseInt(durationStr, 10) || 180
}

function stripHtmlTags(str: string): string {
	if (!str) return ''
	return str.replace(/<[^>]*>?/gm, '')
}

function formatCoverUrl(cover: string): string {
	if (!cover) return ''
	if (cover.startsWith('//')) {
		return 'https:' + cover
	}
	return cover
}

function formatFans(num: number): string {
	if (!num && num !== 0) return '0'
	if (num >= 10000) {
		return (num / 10000).toFixed(1) + '万'
	}
	return num.toLocaleString()
}

export const SearchView: React.FC<SearchViewProps> = ({
	keyword,
	mode = 'video',
	onModeChange,
	onExportTrack,
}) => {
	// Mode State
	const [activeMode, setActiveMode] = useState<'video' | 'up'>(mode)

	// Search Video State
	const [videoResults, setVideoResults] = useState<BilibiliSearchVideo[]>([])
	const [loadingVideos, setLoadingVideos] = useState(false)
	const [videoError, setVideoError] = useState<string | null>(null)

	// Search User State
	const [upResults, setUpResults] = useState<BilibiliSearchUser[]>([])
	const [loadingUps, setLoadingUps] = useState(false)
	const [upError, setUpError] = useState<string | null>(null)

	// Selected UP State (Detail View)
	const [selectedUp, setSelectedUp] = useState<BilibiliSearchUser | null>(null)
	const [upActiveTab, setUpActiveTab] = useState<'songs' | 'collections'>('songs')

	// UP's Uploaded Videos (All Songs) State
	const [upVideos, setUpVideos] = useState<BilibiliTrack[]>([])
	const [upVideosPage, setUpVideosPage] = useState(1)
	const [upVideosTotal, setUpVideosTotal] = useState(0)
	const [loadingUpVideos, setLoadingUpVideos] = useState(false)
	const [upVideosError, setUpVideosError] = useState<string | null>(null)

	// UP's Seasons & Series State
	const [seasons, setSeasons] = useState<BilibiliSeasonItem[]>([])
	const [series, setSeries] = useState<BilibiliSeriesItem[]>([])
	const [loadingCollections, setLoadingCollections] = useState(false)
	const [collectionsError, setCollectionsError] = useState<string | null>(null)

	// Selected Collection Inside UP Detail
	const [activeCollectionDetail, setActiveCollectionDetail] = useState<{
		id: number
		title: string
		cover: string
		type: 'season' | 'series'
		total: number
	} | null>(null)
	const [collectionTracks, setCollectionTracks] = useState<BilibiliTrack[]>([])
	const [loadingCollectionTracks, setLoadingCollectionTracks] = useState(false)

	// Modal States
	const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null)
	const [partsModalVideo, setPartsModalVideo] = useState<{
		bvid: string
		title: string
		coverUrl?: string
		author?: string
	} | null>(null)

	const { setQueue } = useQueueStore()

	// Sync mode prop with internal state
	useEffect(() => {
		if (mode && mode !== activeMode) {
			setActiveMode(mode)
		}
	}, [mode])

	// Switch mode handler
	const handleModeSwitch = (newMode: 'video' | 'up') => {
		setActiveMode(newMode)
		onModeChange?.(newMode)
		setSelectedUp(null)
		setActiveCollectionDetail(null)
	}

	// 1. Execute Video Search
	const executeVideoSearch = async (kw: string) => {
		if (!kw.trim()) return
		setLoadingVideos(true)
		setVideoError(null)

		const res = await bilibiliApi.searchVideos({ keyword: kw.trim(), page: 1 })
		setLoadingVideos(false)

		if (res.isOk()) {
			setVideoResults(res.value.result || [])
		} else {
			setVideoError(res.error.message || '搜索视频失败，请检查网络或重试')
		}
	}

	// 2. Execute UP Search
	const executeUpSearch = async (kw: string) => {
		if (!kw.trim()) return
		setLoadingUps(true)
		setUpError(null)

		const res = await bilibiliApi.searchUsers({ keyword: kw.trim(), page: 1 })
		setLoadingUps(false)

		if (res.isOk()) {
			setUpResults(res.value.result || [])
		} else {
			setUpError(res.error.message || '搜索 UP 主失败，请检查网络或重试')
		}
	}

	// Trigger search on keyword or mode change
	useEffect(() => {
		if (keyword) {
			setSelectedUp(null)
			setActiveCollectionDetail(null)
			if (activeMode === 'video') {
				executeVideoSearch(keyword)
			} else {
				executeUpSearch(keyword)
			}
		}
	}, [keyword, activeMode])

	// Convert Video Item to BilibiliTrack
	const convertVideoToTrack = (item: BilibiliSearchVideo, id: number): BilibiliTrack => {
		const cover = formatCoverUrl(item.pic || '')
		const cleanTitle = stripHtmlTags(item.title)
		const durationSec = parseDurationSeconds(item.duration)

		return {
			id,
			uniqueKey: `bilibili_${item.bvid}_0`,
			title: cleanTitle,
			artist: {
				id: item.mid || id,
				name: item.author || '未知UP主',
				source: 'bilibili',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			coverUrl: cover,
			duration: durationSec,
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
	}

	// Play Single Video Search Result
	const handlePlayVideoItem = async (item: BilibiliSearchVideo, idx: number) => {
		const track = convertVideoToTrack(item, idx + 1000)
		const allTracks = videoResults.map((r, i) => convertVideoToTrack(r, i + 1000))
		setQueue(allTracks, idx)
		try {
			await playTrackWithProxy(track)
		} catch (err: any) {
			console.error('播放失败:', err)
		}
	}

	// 3. Fetch UP's Uploaded Videos (All Songs)
	const fetchUpVideos = async (mid: number, page: number) => {
		setLoadingUpVideos(true)
		setUpVideosError(null)

		const res = await bilibiliApi.getUserUploadedVideos({ mid, pn: page })
		setLoadingUpVideos(false)

		if (res.isOk()) {
			const vlist = res.value.list?.vlist || []
			setUpVideosTotal(res.value.page?.count || 0)
			const tracks: BilibiliTrack[] = vlist.map((item, idx) => ({
				id: item.aid || idx + 1,
				uniqueKey: `bilibili_${item.bvid}_0`,
				title: stripHtmlTags(item.title),
				artist: {
					id: mid,
					name: item.author || selectedUp?.uname || '未知UP主',
					source: 'bilibili',
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				coverUrl: formatCoverUrl(item.pic),
				duration: parseDurationSeconds(item.length),
				source: 'bilibili',
				createdAt: new Date(item.created ? item.created * 1000 : Date.now()),
				updatedAt: new Date(),
				bilibiliMetadata: {
					bvid: item.bvid,
					cid: null,
					isMultiPage: false,
					videoIsValid: true,
				},
			}))
			setUpVideos(tracks)
			setUpVideosPage(page)
		} else {
			setUpVideosError(res.error.message || '获取 UP 主歌曲列表失败')
		}
	}

	// 4. Fetch UP's Seasons & Series
	const fetchUpCollections = async (mid: number) => {
		setLoadingCollections(true)
		setCollectionsError(null)

		let res = await bilibiliApi.getUserAllSeasonsSeriesList({ mid })
		if (!res.isOk()) {
			// 回退单页拉取，严格维持 pageSize <= 20
			res = await bilibiliApi.getUserSeasonsSeriesList({ mid, pageNumber: 1, pageSize: 20 })
		}
		setLoadingCollections(false)

		if (res.isOk()) {
			setSeasons(res.value?.seasons_list || [])
			setSeries(res.value?.series_list || [])
		} else {
			setCollectionsError(res.error.message || '获取 UP 主合集列表失败')
		}
	}

	// When user clicks an UP card: enter UP detail
	const handleSelectUp = (user: BilibiliSearchUser) => {
		setSelectedUp(user)
		setUpActiveTab('songs')
		setActiveCollectionDetail(null)
		fetchUpVideos(user.mid, 1)
		fetchUpCollections(user.mid)
	}

	// Play Single UP Track
	const handlePlayUpTrack = async (track: BilibiliTrack, idx: number) => {
		setQueue(upVideos, idx)
		try {
			await playTrackWithProxy(track)
		} catch (err: any) {
			console.error('播放失败:', err)
		}
	}

	// Play All UP Tracks
	const handlePlayAllUpTracks = async () => {
		if (upVideos.length === 0) return
		setQueue(upVideos, 0)
		try {
			await playTrackWithProxy(upVideos[0]!)
		} catch (err: any) {
			console.error('播放全部失败:', err)
		}
	}

	// 5. Fetch Full Contents of a Season or Series
	const handleOpenCollection = async (
		id: number,
		title: string,
		cover: string,
		type: 'season' | 'series',
		total: number,
	) => {
		setActiveCollectionDetail({ id, title, cover, type, total })
		setLoadingCollectionTracks(true)
		setCollectionTracks([])

		if (type === 'season') {
			const res = await bilibiliApi.getCollectionAllContents({ collectionId: id })
			setLoadingCollectionTracks(false)
			if (res.isOk()) {
				const medias = res.value.medias || []
				const tracks: BilibiliTrack[] = medias.map((m, idx) => ({
					id: m.id || idx + 1,
					uniqueKey: `bilibili_${m.bvid}_0`,
					title: stripHtmlTags(m.title),
					artist: {
						id: m.upper?.mid || selectedUp?.mid || 0,
						name: m.upper?.name || selectedUp?.uname || '未知UP主',
						source: 'bilibili',
						createdAt: new Date(),
						updatedAt: new Date(),
					},
					coverUrl: formatCoverUrl(m.cover),
					duration: m.duration || 180,
					source: 'bilibili',
					createdAt: new Date(m.pubtime ? m.pubtime * 1000 : Date.now()),
					updatedAt: new Date(),
					bilibiliMetadata: {
						bvid: m.bvid,
						cid: null,
						isMultiPage: false,
						videoIsValid: true,
					},
				}))
				setCollectionTracks(tracks)
			}
		} else {
			const res = await bilibiliApi.getSeriesArchivesPage({
				seriesId: id,
				mid: selectedUp?.mid || 0,
				pageNumber: 1,
				pageSize: 100,
			})
			setLoadingCollectionTracks(false)
			if (res.isOk()) {
				const archives = res.value.archives || []
				const tracks: BilibiliTrack[] = archives.map((a, idx) => ({
					id: a.aid || idx + 1,
					uniqueKey: `bilibili_${a.bvid}_0`,
					title: stripHtmlTags(a.title),
					artist: {
						id: a.upMid || selectedUp?.mid || 0,
						name: selectedUp?.uname || '未知UP主',
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
				setCollectionTracks(tracks)
			}
		}
	}

	// Play Single Track inside Collection
	const handlePlayCollectionTrack = async (track: BilibiliTrack, idx: number) => {
		setQueue(collectionTracks, idx)
		try {
			await playTrackWithProxy(track)
		} catch (err: any) {
			console.error('播放合集歌曲失败:', err)
		}
	}

	// Play All Collection Tracks
	const handlePlayAllCollectionTracks = async () => {
		if (collectionTracks.length === 0) return
		setQueue(collectionTracks, 0)
		try {
			await playTrackWithProxy(collectionTracks[0]!)
		} catch (err: any) {
			console.error('播放全部合集歌曲失败:', err)
		}
	}

	// Quick Play Season/Series from Card Archives
	const handleQuickPlaySeasonSeries = async (
		item: BilibiliSeasonItem | BilibiliSeriesItem,
		type: 'season' | 'series',
	) => {
		const archives = item.archives || []
		if (archives.length === 0) {
			const id =
				type === 'season'
					? (item as BilibiliSeasonItem).meta.season_id
					: (item as BilibiliSeriesItem).meta.series_id
			handleOpenCollection(id, item.meta.name, item.meta.cover, type, item.meta.total)
			return
		}
		const tracks: BilibiliTrack[] = archives.map((a, idx) => ({
			id: a.aid || idx + 1,
			uniqueKey: `bilibili_${a.bvid}_0`,
			title: stripHtmlTags(a.title),
			artist: {
				id: selectedUp?.mid || 0,
				name: selectedUp?.uname || '未知UP主',
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
		setQueue(tracks, 0)
		try {
			await playTrackWithProxy(tracks[0]!)
		} catch (err: any) {
			console.error('播放合集失败:', err)
		}
	}

	return (
		<div className="space-y-6 max-w-6xl pb-12 select-none">
			{/* Top Header & Search Mode Tabs */}
			{!selectedUp ? (
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
					<div>
						<h2 className="text-base font-bold text-foreground flex items-center gap-2">
							<Search className="w-4 h-4 text-primary" />
							<span>搜索结果："{keyword}"</span>
						</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							{activeMode === 'video'
								? `找到 ${videoResults.length} 个相关单曲/视频资源`
								: `找到 ${upResults.length} 个相关 UP 主创作者`}
						</p>
					</div>

					{/* Mode Switcher Tabs */}
					<div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
						<button
							onClick={() => handleModeSwitch('video')}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
								activeMode === 'video'
									? 'bg-primary text-white font-medium shadow-md'
									: 'text-muted-foreground hover:text-foreground hover:bg-white/5'
							}`}
						>
							<Music className="w-3.5 h-3.5" />
							<span>单曲 / 视频</span>
							{videoResults.length > 0 && (
								<span className="text-[10px] opacity-80 font-mono">({videoResults.length})</span>
							)}
						</button>
						<button
							onClick={() => handleModeSwitch('up')}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
								activeMode === 'up'
									? 'bg-[#00AEEC] text-white font-medium shadow-md'
									: 'text-muted-foreground hover:text-foreground hover:bg-white/5'
							}`}
						>
							<User className="w-3.5 h-3.5" />
							<span>UP 主</span>
							{upResults.length > 0 && (
								<span className="text-[10px] opacity-80 font-mono">({upResults.length})</span>
							)}
						</button>
					</div>
				</div>
			) : (
				/* UP Detail Header with Back Breadcrumbs */
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<button
							onClick={() => {
								if (activeCollectionDetail) {
									setActiveCollectionDetail(null)
								} else {
									setSelectedUp(null)
								}
							}}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-white border border-white/5 transition-colors cursor-pointer"
						>
							<ArrowLeft className="w-3.5 h-3.5" />
							<span>
								{activeCollectionDetail
									? `返回 ${selectedUp.uname} 的合集列表`
									: `返回 UP 主搜索结果`}
							</span>
						</button>

						<div className="text-[11px] text-muted-foreground">
							<span>搜索："{keyword}"</span>
							<span className="mx-1.5">/</span>
							<span className="text-foreground">{selectedUp.uname}</span>
							{activeCollectionDetail && (
								<>
									<span className="mx-1.5">/</span>
									<span className="text-primary font-medium">{activeCollectionDetail.title}</span>
								</>
							)}
						</div>
					</div>

					{/* UP Hero Card */}
					{!activeCollectionDetail && (
						<div className="relative p-6 rounded-2xl bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent border border-white/10 shadow-xl overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
							<div className="flex items-center gap-5">
								<div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#00AEEC]/40 shadow-[0_0_20px_rgba(0,174,236,0.2)] flex-shrink-0 bg-black/40">
									<img
										src={formatCoverUrl(selectedUp.upic)}
										alt={selectedUp.uname}
										referrerPolicy="no-referrer"
										className="w-full h-full object-cover"
									/>
								</div>
								<div className="space-y-1.5">
									<div className="flex items-center gap-2">
										<h2 className="text-lg font-bold text-foreground">{selectedUp.uname}</h2>
										{selectedUp.verify_info && (
											<span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00AEEC]/15 text-[#00AEEC] border border-[#00AEEC]/30 text-[10px] font-medium">
												<CheckCircle2 className="w-3 h-3" />
												<span>{selectedUp.verify_info}</span>
											</span>
										)}
									</div>
									<div className="flex items-center gap-4 text-xs text-muted-foreground">
										<span>UID: {selectedUp.mid}</span>
										<span>•</span>
										<span className="text-[#00AEEC] font-medium">
											{formatFans(selectedUp.fans)} 粉丝
										</span>
										<span>•</span>
										<span>{upVideosTotal || selectedUp.videos || 0} 投稿视频</span>
									</div>
									{selectedUp.usign && (
										<p className="text-xs text-muted-foreground/80 line-clamp-2 max-w-xl">
											{selectedUp.usign}
										</p>
									)}
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-3 w-full md:w-auto">
								<button
									onClick={handlePlayAllUpTracks}
									disabled={upVideos.length === 0}
									className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-xs shadow-lg shadow-primary/25 disabled:opacity-50 transition-all cursor-pointer"
								>
									<Play className="w-4 h-4 fill-current" />
									<span>一键播放全部歌曲</span>
								</button>
							</div>
						</div>
					)}
				</div>
			)}

			{/* ================= MODE: VIDEO SEARCH ================= */}
			{!selectedUp && activeMode === 'video' && (
				<>
					{/* Loading State */}
					{loadingVideos && (
						<div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
							<Loader2 className="w-6 h-6 animate-spin text-primary" />
							<span>正在全网检索哔哩哔哩优质音源...</span>
						</div>
					)}

					{/* Error State */}
					{!loadingVideos && videoError && (
						<div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-3">
							<AlertCircle className="w-5 h-5 flex-shrink-0" />
							<div className="flex-1">
								<p className="font-semibold">搜索发生异常</p>
								<p className="mt-0.5 text-destructive/80">{videoError}</p>
							</div>
							<button
								onClick={() => executeVideoSearch(keyword)}
								className="px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive font-medium transition-colors"
							>
								重试
							</button>
						</div>
					)}

					{/* Empty State */}
					{!loadingVideos && !videoError && videoResults.length === 0 && (
						<div className="py-24 text-center text-muted-foreground text-xs rounded-xl border border-dashed border-white/10">
							未检索到相关视频内容，请尝试更换关键词
						</div>
					)}

					{/* Results Grid */}
					{!loadingVideos && !videoError && videoResults.length > 0 && (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							{videoResults.map((item, idx) => {
								const cover = formatCoverUrl(item.pic || '')
								const cleanTitle = stripHtmlTags(item.title)

								return (
									<div
										key={item.bvid || idx}
										className="group relative rounded-xl p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
									>
										{/* Cover Box */}
										<div
											className="relative w-full aspect-video rounded-lg overflow-hidden mb-2.5 bg-black/40"
											onClick={() => handlePlayVideoItem(item, idx)}
										>
											<img
												src={cover}
												alt={cleanTitle}
												referrerPolicy="no-referrer"
												className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
											/>
											<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
												<div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
													<Play className="w-4 h-4 fill-current ml-0.5" />
												</div>
											</div>
											<span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
												{item.duration}
											</span>
										</div>

										{/* Info */}
										<div className="space-y-1">
											<p
												className="text-xs font-semibold line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-tight"
												title={cleanTitle}
												onClick={() => handlePlayVideoItem(item, idx)}
											>
												{cleanTitle}
											</p>
											<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
												<span className="truncate flex-1 mr-2 flex items-center gap-1">
													<User className="w-3 h-3 flex-shrink-0" />
													<span className="truncate">{item.author}</span>
												</span>
												<div className="flex items-center gap-1">
													<button
														onClick={(e) => {
															e.stopPropagation()
															setPartsModalVideo({
																bvid: item.bvid,
																title: cleanTitle,
																coverUrl: cover || undefined,
																author: item.author || undefined,
															})
														}}
														title="查看并播放分 P 选集"
														className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-[#00AEEC] transition-colors"
													>
														<Layers className="w-3.5 h-3.5" />
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation()
															setAddToPlaylistTrack(convertVideoToTrack(item, idx + 1000))
														}}
														title="添加到我的歌单"
														className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
													>
														<FolderPlus className="w-3.5 h-3.5" />
													</button>
													{onExportTrack && (
														<button
															onClick={(e) => {
															e.stopPropagation()
															onExportTrack(convertVideoToTrack(item, idx + 1000))
														}}
														title="导出音频"
														className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
													>
														<Download className="w-3.5 h-3.5" />
													</button>
												)}
											</div>
										</div>
									</div>
								</div>
							)
						})}
					</div>
				)}
			</>
		)}

		{/* ================= MODE: UP SEARCH RESULTS ================= */}
		{!selectedUp && activeMode === 'up' && (
			<>
				{/* Loading State */}
				{loadingUps && (
					<div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
						<Loader2 className="w-6 h-6 animate-spin text-[#00AEEC]" />
						<span>正在全网检索哔哩哔哩 UP 主创作者...</span>
					</div>
				)}

				{/* Error State */}
				{!loadingUps && upError && (
					<div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-3">
						<AlertCircle className="w-5 h-5 flex-shrink-0" />
						<div className="flex-1">
							<p className="font-semibold">搜索 UP 主发生异常</p>
							<p className="mt-0.5 text-destructive/80">{upError}</p>
						</div>
						<button
							onClick={() => executeUpSearch(keyword)}
							className="px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive font-medium transition-colors"
						>
							重试
						</button>
					</div>
				)}

				{/* Empty State */}
				{!loadingUps && !upError && upResults.length === 0 && (
					<div className="py-24 text-center text-muted-foreground text-xs rounded-xl border border-dashed border-white/10">
						未检索到相关 UP 主，请尝试更换关键词
					</div>
				)}

				{/* UP Results Grid */}
				{!loadingUps && !upError && upResults.length > 0 && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{upResults.map((user) => {
							const avatar = formatCoverUrl(user.upic)
							return (
								<div
									key={user.mid}
									onClick={() => handleSelectUp(user)}
									className="group p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-[#00AEEC]/30 transition-all duration-200 cursor-pointer flex items-center gap-4 relative overflow-hidden"
								>
									{/* Glow hint on hover */}
									<div className="absolute inset-0 bg-gradient-to-r from-[#00AEEC]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

									{/* UP Avatar */}
									<div className="relative w-14 h-14 rounded-full overflow-hidden border border-white/10 group-hover:border-[#00AEEC]/50 flex-shrink-0 bg-black/40 transition-colors">
										<img
											src={avatar}
											alt={user.uname}
											referrerPolicy="no-referrer"
											className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
										/>
									</div>

									{/* UP Info */}
									<div className="flex-1 min-w-0 space-y-1">
										<div className="flex items-center gap-1.5">
											<h3 className="text-xs font-bold text-foreground group-hover:text-[#00AEEC] truncate transition-colors">
												{user.uname}
											</h3>
											{user.verify_info && (
												<CheckCircle2 className="w-3.5 h-3.5 text-[#00AEEC] flex-shrink-0" />
											)}
										</div>
										<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
											<span className="text-[#00AEEC] font-medium">
												{formatFans(user.fans)} 粉丝
											</span>
											<span>•</span>
											<span>{user.videos} 个视频</span>
										</div>
										{user.usign && (
											<p className="text-[11px] text-muted-foreground/70 truncate">
												{user.usign}
											</p>
										)}
									</div>

									{/* View Arrow */}
									<div className="p-2 rounded-xl bg-white/5 group-hover:bg-[#00AEEC] text-muted-foreground group-hover:text-white transition-all flex-shrink-0">
										<ChevronRight className="w-4 h-4" />
									</div>
								</div>
							)
						})}
					</div>
				)}
			</>
		)}

		{/* ================= UP DETAIL: SONGS & COLLECTIONS ================= */}
		{selectedUp && (
			<div className="space-y-6">
				{/* Sub Tabs: Songs vs Collections (Only when not inspecting single collection) */}
				{!activeCollectionDetail && (
					<div className="flex items-center justify-between border-b border-white/5 pb-3">
						<div className="flex items-center gap-2">
							<button
								onClick={() => setUpActiveTab('songs')}
								className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all ${
									upActiveTab === 'songs'
										? 'bg-white/10 text-white font-semibold shadow-inner'
										: 'text-muted-foreground hover:text-foreground hover:bg-white/5'
								}`}
							>
								<ListMusic className="w-3.5 h-3.5 text-primary" />
								<span>全部歌曲 / 视频</span>
								<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 font-mono">
									{upVideosTotal}
								</span>
							</button>
							<button
								onClick={() => setUpActiveTab('collections')}
								className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all ${
									upActiveTab === 'collections'
										? 'bg-white/10 text-white font-semibold shadow-inner'
										: 'text-muted-foreground hover:text-foreground hover:bg-white/5'
								}`}
							>
								<FolderHeart className="w-3.5 h-3.5 text-[#00AEEC]" />
								<span>合集与系列</span>
								<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 font-mono">
									{seasons.length + series.length}
								</span>
							</button>
						</div>

						{/* Page Switcher for Songs */}
						{upActiveTab === 'songs' && upVideosTotal > 30 && (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span>
									第 {upVideosPage} 页 / 共 {Math.ceil(upVideosTotal / 30)} 页
								</span>
								<div className="flex items-center gap-1">
									<button
										onClick={() => fetchUpVideos(selectedUp.mid, upVideosPage - 1)}
										disabled={upVideosPage <= 1 || loadingUpVideos}
										className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
									>
										<ChevronLeft className="w-4 h-4" />
									</button>
									<button
										onClick={() => fetchUpVideos(selectedUp.mid, upVideosPage + 1)}
										disabled={upVideosPage * 30 >= upVideosTotal || loadingUpVideos}
										className="p-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
									>
										<ChevronRight className="w-4 h-4" />
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{/* 1. UP All Songs Tab */}
				{!activeCollectionDetail && upActiveTab === 'songs' && (
					<>
						{loadingUpVideos && (
							<div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
								<Loader2 className="w-6 h-6 animate-spin text-primary" />
								<span>正在加载 UP 主全部投稿音频...</span>
							</div>
						)}

						{!loadingUpVideos && upVideosError && (
							<div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-3">
								<AlertCircle className="w-5 h-5 flex-shrink-0" />
								<div className="flex-1">
									<p className="font-semibold">加载歌曲失败</p>
									<p className="mt-0.5 text-destructive/80">{upVideosError}</p>
								</div>
								<button
									onClick={() => fetchUpVideos(selectedUp.mid, upVideosPage)}
									className="px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive font-medium transition-colors"
								>
									重试
								</button>
							</div>
						)}

						{!loadingUpVideos && !upVideosError && upVideos.length === 0 && (
							<div className="py-20 text-center text-muted-foreground text-xs rounded-xl border border-dashed border-white/10">
								该 UP 主暂未发布任何公开视频或音频
							</div>
						)}

						{!loadingUpVideos && !upVideosError && upVideos.length > 0 && (
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
								{upVideos.map((track, idx) => (
									<div
										key={track.uniqueKey || idx}
										className="group relative rounded-xl p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
									>
										{/* Cover */}
										<div
											className="relative w-full aspect-video rounded-lg overflow-hidden mb-2.5 bg-black/40"
											onClick={() => handlePlayUpTrack(track, idx)}
										>
											<img
												src={track.coverUrl || ''}
												alt={track.title}
												referrerPolicy="no-referrer"
												className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
											/>
											<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
												<div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
													<Play className="w-4 h-4 fill-current ml-0.5" />
												</div>
											</div>
											<span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
												{Math.floor(track.duration / 60)}:
												{(track.duration % 60).toString().padStart(2, '0')}
											</span>
										</div>

										{/* Info */}
										<div className="space-y-1">
											<p
												className="text-xs font-semibold line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-tight"
												title={track.title}
												onClick={() => handlePlayUpTrack(track, idx)}
											>
												{track.title}
											</p>
											<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
												<span className="truncate flex-1 mr-2 text-[10px]">
													{track.createdAt
														? new Date(track.createdAt).toLocaleDateString()
														: ''}
												</span>
												<div className="flex items-center gap-1">
													<button
														onClick={(e) => {
															e.stopPropagation()
															setPartsModalVideo({
																bvid: track.bilibiliMetadata.bvid,
																title: track.title,
																coverUrl: track.coverUrl || undefined,
																author: track.artist?.name || undefined,
															})
														}}
														title="查看分 P 选集"
														className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-[#00AEEC] transition-colors"
													>
														<Layers className="w-3.5 h-3.5" />
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation()
															setAddToPlaylistTrack(track)
														}}
														title="添加到歌单"
														className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
													>
														<FolderPlus className="w-3.5 h-3.5" />
													</button>
													{onExportTrack && (
														<button
															onClick={(e) => {
																e.stopPropagation()
																onExportTrack(track)
															}}
															title="导出音频"
															className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
														>
															<Download className="w-3.5 h-3.5" />
														</button>
													)}
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</>
				)}

				{/* 2. UP Collections & Series Tab */}
				{!activeCollectionDetail && upActiveTab === 'collections' && (
					<>
						{loadingCollections && (
							<div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
								<Loader2 className="w-6 h-6 animate-spin text-[#00AEEC]" />
								<span>正在检索 UP 主合集与系列...</span>
							</div>
						)}

						{!loadingCollections && collectionsError && (
							<div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-3">
								<AlertCircle className="w-5 h-5 flex-shrink-0" />
								<div className="flex-1">
									<p className="font-semibold">加载合集失败</p>
									<p className="mt-0.5 text-destructive/80">{collectionsError}</p>
								</div>
								<button
									onClick={() => fetchUpCollections(selectedUp.mid)}
									className="px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive font-medium transition-colors"
								>
									重试
								</button>
							</div>
						)}

						{!loadingCollections && !collectionsError && seasons.length === 0 && series.length === 0 && (
							<div className="py-20 text-center text-muted-foreground text-xs rounded-xl border border-dashed border-white/10">
								该 UP 主暂未创建任何合集或系列
							</div>
						)}

						{/* Collections & Series Grid */}
						{!loadingCollections && !collectionsError && (seasons.length > 0 || series.length > 0) && (
							<div className="space-y-6">
								{/* Seasons */}
								{seasons.length > 0 && (
									<div className="space-y-3">
										<div className="flex items-center gap-2 text-xs font-bold text-foreground">
											<FolderHeart className="w-4 h-4 text-primary" />
											<span>视频合集 ({seasons.length})</span>
										</div>
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
											{seasons.map((item) => {
												const cover = formatCoverUrl(item.meta.cover)
												return (
													<div
														key={`season_${item.meta.season_id}`}
														onClick={() =>
															handleOpenCollection(
																item.meta.season_id,
																item.meta.name || item.meta.title || '合集',
																cover,
																'season',
																item.meta.total,
															)
														}
														className="group relative rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-primary/40 transition-all p-3 flex gap-3.5 cursor-pointer overflow-hidden"
													>
														{/* Cover */}
														<div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-black/40 flex-shrink-0">
															<img
																src={cover}
																alt={item.meta.name}
																referrerPolicy="no-referrer"
																className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
															/>
															<span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[9px] text-white font-mono">
																{item.meta.total} 首
															</span>
														</div>

														{/* Meta */}
														<div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
															<div>
																<div className="flex items-center gap-1.5 mb-1">
																	<span className="px-1.5 py-0.2 rounded bg-primary/20 text-primary text-[9px] font-medium border border-primary/30">
																		合集
																	</span>
																	<h4 className="text-xs font-bold text-foreground group-hover:text-primary truncate transition-colors">
																		{item.meta.name || item.meta.title}
																	</h4>
																</div>
																<p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
																	{item.meta.description || '暂无合集简介'}
																</p>
															</div>

															<div className="flex items-center justify-between pt-1">
																<span className="text-[10px] text-muted-foreground/70">
																	共 {item.meta.total} 首歌曲
																</span>
																<button
																	onClick={(e) => {
																		e.stopPropagation()
																		handleQuickPlaySeasonSeries(item, 'season')
																	}}
																	className="p-1 rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-white transition-all"
																	title="播放此合集"
																>
																	<Play className="w-3.5 h-3.5 fill-current ml-0.5" />
																</button>
															</div>
														</div>
													</div>
												)
											})}
										</div>
									</div>
								)}

								{/* Series */}
								{series.length > 0 && (
									<div className="space-y-3 pt-2">
										<div className="flex items-center gap-2 text-xs font-bold text-foreground">
											<Layers className="w-4 h-4 text-[#00AEEC]" />
											<span>视频系列 ({series.length})</span>
										</div>
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
											{series.map((item) => {
												const cover = formatCoverUrl(item.meta.cover)
												return (
													<div
														key={`series_${item.meta.series_id}`}
														onClick={() =>
															handleOpenCollection(
																item.meta.series_id,
																item.meta.name,
																cover,
																'series',
																item.meta.total,
															)
														}
														className="group relative rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-[#00AEEC]/40 transition-all p-3 flex gap-3.5 cursor-pointer overflow-hidden"
													>
														{/* Cover */}
														<div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-black/40 flex-shrink-0">
															<img
																src={cover}
																alt={item.meta.name}
																referrerPolicy="no-referrer"
																className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
															/>
															<span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[9px] text-white font-mono">
																{item.meta.total} 首
															</span>
														</div>

														{/* Meta */}
														<div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
															<div>
																<div className="flex items-center gap-1.5 mb-1">
																	<span className="px-1.5 py-0.2 rounded bg-[#00AEEC]/20 text-[#00AEEC] text-[9px] font-medium border border-[#00AEEC]/30">
																		系列
																	</span>
																	<h4 className="text-xs font-bold text-foreground group-hover:text-[#00AEEC] truncate transition-colors">
																		{item.meta.name}
																	</h4>
																</div>
																<p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
																	{item.meta.description || '暂无系列简介'}
																</p>
															</div>

															<div className="flex items-center justify-between pt-1">
																<span className="text-[10px] text-muted-foreground/70">
																	共 {item.meta.total} 首歌曲
																</span>
																<button
																	onClick={(e) => {
																		e.stopPropagation()
																		handleQuickPlaySeasonSeries(item, 'series')
																	}}
																	className="p-1 rounded-lg bg-[#00AEEC]/20 hover:bg-[#00AEEC] text-[#00AEEC] hover:text-white transition-all"
																	title="播放此系列"
																>
																	<Play className="w-3.5 h-3.5 fill-current ml-0.5" />
																</button>
															</div>
														</div>
													</div>
												)
											})}
										</div>
									</div>
								)}
							</div>
						)}
					</>
				)}

				{/* 3. Specific Collection Detail View (Tracklist) */}
				{activeCollectionDetail && (
					<div className="space-y-5">
						{/* Collection Header Banner */}
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/10">
							<div className="flex items-center gap-4">
								<div className="w-24 aspect-video rounded-xl overflow-hidden bg-black/40 flex-shrink-0">
									<img
										src={activeCollectionDetail.cover}
										alt={activeCollectionDetail.title}
										referrerPolicy="no-referrer"
										className="w-full h-full object-cover"
									/>
								</div>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span
											className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
												activeCollectionDetail.type === 'season'
													? 'bg-primary/20 text-primary border-primary/30'
													: 'bg-[#00AEEC]/20 text-[#00AEEC] border-[#00AEEC]/30'
											}`}
										>
											{activeCollectionDetail.type === 'season' ? '合集' : '系列'}
										</span>
										<h3 className="text-base font-bold text-foreground">
											{activeCollectionDetail.title}
										</h3>
									</div>
									<p className="text-xs text-muted-foreground">
										UP 主：{selectedUp.uname} • 共 {collectionTracks.length} 首歌曲
									</p>
								</div>
							</div>

							<button
								onClick={handlePlayAllCollectionTracks}
								disabled={collectionTracks.length === 0}
								className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-xs shadow-md shadow-primary/20 disabled:opacity-50 transition-all cursor-pointer"
							>
								<Play className="w-3.5 h-3.5 fill-current" />
								<span>播放整个合集</span>
							</button>
						</div>

						{/* Collection Tracks List */}
						{loadingCollectionTracks ? (
							<div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
								<Loader2 className="w-6 h-6 animate-spin text-primary" />
								<span>正在加载合集包含的歌曲...</span>
							</div>
						) : collectionTracks.length === 0 ? (
							<div className="py-20 text-center text-muted-foreground text-xs rounded-xl border border-dashed border-white/10">
								未获取到此合集内的歌曲内容
							</div>
						) : (
							<div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden divide-y divide-white/5">
								{collectionTracks.map((track, idx) => (
									<div
										key={track.uniqueKey || idx}
										onClick={() => handlePlayCollectionTrack(track, idx)}
										className="group flex items-center justify-between px-4 py-3 hover:bg-white/[0.06] transition-colors cursor-pointer text-xs"
									>
										<div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
											<span className="w-6 text-center text-muted-foreground/60 font-mono text-[11px] group-hover:text-primary">
												{(idx + 1).toString().padStart(2, '0')}
											</span>
											<div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
												<img
													src={track.coverUrl || ''}
													alt={track.title}
													referrerPolicy="no-referrer"
													className="w-full h-full object-cover"
												/>
											</div>
											<div className="min-w-0 flex-1">
												<p className="font-medium text-foreground group-hover:text-primary truncate transition-colors">
													{track.title}
												</p>
												<p className="text-[11px] text-muted-foreground truncate">
													{track.artist?.name || '未知UP主'}
												</p>
											</div>
										</div>

										{/* Right Actions */}
										<div className="flex items-center gap-3 text-muted-foreground">
											<span className="font-mono text-[11px]">
												{Math.floor(track.duration / 60)}:
												{(track.duration % 60).toString().padStart(2, '0')}
											</span>
											<button
												onClick={(e) => {
													e.stopPropagation()
													setAddToPlaylistTrack(track)
												}}
												title="添加到歌单"
												className="p-1.5 rounded-lg hover:bg-white/10 hover:text-primary transition-colors"
											>
												<FolderPlus className="w-4 h-4" />
											</button>
											{onExportTrack && (
												<button
													onClick={(e) => {
														e.stopPropagation()
														onExportTrack(track)
													}}
													title="导出音频"
													className="p-1.5 rounded-lg hover:bg-white/10 hover:text-foreground transition-colors"
												>
													<Download className="w-4 h-4" />
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		)}

		{/* Add to Playlist Modal */}
		<AddToPlaylistModal
			isOpen={!!addToPlaylistTrack}
			track={addToPlaylistTrack}
			onClose={() => setAddToPlaylistTrack(null)}
		/>

		{/* Video Parts Modal */}
		{partsModalVideo && (
			<VideoPartsModal
				isOpen={!!partsModalVideo}
				onClose={() => setPartsModalVideo(null)}
				bvid={partsModalVideo.bvid}
				title={partsModalVideo.title}
				coverUrl={partsModalVideo.coverUrl || undefined}
				author={partsModalVideo.author || undefined}
			/>
		)}
	</div>
)
}
