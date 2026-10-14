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
} from 'lucide-react'
import {
	bilibiliApi,
	type BilibiliSearchVideo,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import { useQueueStore } from '@bbplayer/shared-core'
import { AddToPlaylistModal } from '../modals/AddToPlaylistModal'

export interface SearchViewProps {
	keyword: string
	onExportTrack?: (track: Track) => void
}

function parseDurationSeconds(durationStr: string): number {
	const parts = durationStr.split(':').map((p) => parseInt(p, 10))
	if (parts.length === 2) {
		return (parts[0] || 0) * 60 + (parts[1] || 0)
	} else if (parts.length === 3) {
		return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
	}
	return parseInt(durationStr, 10) || 180
}

function stripHtmlTags(str: string): string {
	return str.replace(/<[^>]*>?/gm, '')
}

export const SearchView: React.FC<SearchViewProps> = ({
	keyword,
	onExportTrack,
}) => {
	const [results, setResults] = useState<BilibiliSearchVideo[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null)
	const { setQueue } = useQueueStore()

	const executeSearch = async (kw: string) => {
		if (!kw.trim()) return
		setLoading(true)
		setError(null)

		const res = await bilibiliApi.searchVideos({ keyword: kw.trim(), page: 1 })
		setLoading(false)

		if (res.isOk()) {
			setResults(res.value.result || [])
		} else {
			setError(res.error.message || '搜索请求失败，请检查网络或重试')
		}
	}

	useEffect(() => {
		if (keyword) {
			executeSearch(keyword)
		}
	}, [keyword])

	const convertToTrack = (item: BilibiliSearchVideo, id: number): BilibiliTrack => {
		let cover = item.pic || ''
		if (cover.startsWith('//')) {
			cover = 'https:' + cover
		}
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

	const handlePlayItem = async (item: BilibiliSearchVideo, idx: number) => {
		const track = convertToTrack(item, idx + 1000)
		const allTracks = results.map((r, i) => convertToTrack(r, i + 1000))
		setQueue(allTracks, idx)
		try {
			await playTrackWithProxy(track)
		} catch (err: any) {
			console.error('播放失败:', err)
		}
	}

	return (
		<div className="space-y-6 max-w-6xl pb-10">
			{/* Search Header */}
			<div className="flex items-center justify-between border-b border-white/5 pb-4">
				<div>
					<h2 className="text-base font-bold text-foreground flex items-center gap-2">
						<Search className="w-4 h-4 text-primary" />
						<span>搜索结果："{keyword}"</span>
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						找到 {results.length} 个相关音频/视频资源
					</p>
				</div>
			</div>

			{/* Loading State */}
			{loading && (
				<div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
					<Loader2 className="w-6 h-6 animate-spin text-primary" />
					<span>正在全网检索哔哩哔哩优质音源...</span>
				</div>
			)}

			{/* Error State */}
			{!loading && error && (
				<div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-3">
					<AlertCircle className="w-5 h-5 flex-shrink-0" />
					<div className="flex-1">
						<p className="font-semibold">搜索发生异常</p>
						<p className="mt-0.5 text-destructive/80">{error}</p>
					</div>
					<button
						onClick={() => executeSearch(keyword)}
						className="px-3 py-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive font-medium transition-colors"
					>
						重试
					</button>
				</div>
			)}

			{/* Empty State */}
			{!loading && !error && results.length === 0 && (
				<div className="py-20 text-center text-muted-foreground text-xs rounded-xl border border-dashed border-white/10">
					未检索到相关内容，请尝试更换关键词
				</div>
			)}

			{/* Results Grid */}
			{!loading && !error && results.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
					{results.map((item, idx) => {
						let cover = item.pic || ''
						if (cover.startsWith('//')) {
							cover = 'https:' + cover
						}
						const cleanTitle = stripHtmlTags(item.title)

						return (
							<div
								key={item.bvid || idx}
								className="group relative rounded-xl p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
							>
								{/* Cover Box */}
								<div
									className="relative w-full aspect-video rounded-lg overflow-hidden mb-2.5 bg-black/40"
									onClick={() => handlePlayItem(item, idx)}
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
										onClick={() => handlePlayItem(item, idx)}
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
													setAddToPlaylistTrack(convertToTrack(item, idx + 1000))
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
														onExportTrack(convertToTrack(item, idx + 1000))
													}}
													title="导出为 .m4a"
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

			{/* Add to Playlist Modal */}
			<AddToPlaylistModal
				isOpen={!!addToPlaylistTrack}
				track={addToPlaylistTrack}
				onClose={() => setAddToPlaylistTrack(null)}
			/>
		</div>
	)
}
