import React, { useState, useEffect } from 'react'
import {
	X,
	Search,
	Loader2,
	RefreshCw,
	CheckCircle2,
	Clock,
	Play,
	User,
} from 'lucide-react'
import {
	bilibiliApi,
	useLocalPlaylistStore,
	useQueueStore,
	type BilibiliSearchVideo,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'

export interface ReplaceTrackModalProps {
	isOpen: boolean
	playlistId: string
	targetTrack: Track | null
	onClose: () => void
	onSuccess?: (newTrack: Track) => void
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
	return str
		.replace(/<[^>]*>?/gm, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
}

export const ReplaceTrackModal: React.FC<ReplaceTrackModalProps> = ({
	isOpen,
	playlistId,
	targetTrack,
	onClose,
	onSuccess,
}) => {
	const [keyword, setKeyword] = useState('')
	const [results, setResults] = useState<BilibiliSearchVideo[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [replacedSuccessTrack, setReplacedSuccessTrack] = useState<Track | null>(null)

	useEffect(() => {
		if (isOpen && targetTrack) {
			const initialKw = `${targetTrack.title} ${targetTrack.artist?.name || ''}`.trim()
			setKeyword(initialKw)
			setResults([])
			setError(null)
			setReplacedSuccessTrack(null)
			if (initialKw) {
				handleSearch(initialKw)
			}
		}
	}, [isOpen, targetTrack])

	if (!isOpen || !targetTrack) return null

	const handleSearch = async (kw: string) => {
		if (!kw.trim()) return
		setLoading(true)
		setError(null)
		try {
			const res = await bilibiliApi.searchVideos({ keyword: kw.trim(), page: 1 })
			if (res.isOk()) {
				setResults(res.value.result || [])
			} else {
				setError(res.error.message || '搜索候选失败，请重试')
			}
		} catch (err: any) {
			setError(err?.message || '搜索异常')
		} finally {
			setLoading(false)
		}
	}

	const handleReplaceWith = (video: BilibiliSearchVideo) => {
		let cover = video.pic || ''
		if (cover.startsWith('//')) {
			cover = 'https:' + cover
		}
		const cleanTitle = stripHtmlTags(video.title)
		const durationSec = parseDurationSeconds(video.duration)

		const updatedTrack: BilibiliTrack = {
			...targetTrack,
			source: 'bilibili',
			uniqueKey: `bilibili_${video.bvid}_0`,
			// 保留原歌单内规范歌名，附带 B 站视频标题信息
			title: targetTrack.title || cleanTitle,
			coverUrl: cover || targetTrack.coverUrl,
			duration: durationSec > 0 ? durationSec : targetTrack.duration,
			artist: {
				id: video.mid || targetTrack.artist?.id || 0,
				name: targetTrack.artist?.name || video.author || '未知歌手',
				source: 'bilibili',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			bilibiliMetadata: {
				bvid: video.bvid,
				cid: null,
				isMultiPage: false,
				videoIsValid: true,
				mainTrackTitle: cleanTitle,
			},
		}

		// 1. 更新歌单内歌曲
		useLocalPlaylistStore
			.getState()
			.updateTrackInPlaylist(playlistId, targetTrack.uniqueKey, updatedTrack)

		// 2. 如果当前播放队列包含此歌曲，同步热更新队列与当前播放
		const queueStore = useQueueStore.getState()
		const queueIndex = queueStore.queue.findIndex(
			(t) => t.uniqueKey === targetTrack.uniqueKey,
		)
		if (queueIndex !== -1) {
			const newQueue = [...queueStore.queue]
			newQueue[queueIndex] = updatedTrack
			useQueueStore.setState({ queue: newQueue })
		}

		setReplacedSuccessTrack(updatedTrack)
		setTimeout(() => {
			onSuccess?.(updatedTrack)
			onClose()
		}, 800)
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-xl max-h-[85vh] rounded-2xl bg-[#0d121f]/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col p-5 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
							<RefreshCw className="w-4 h-4" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-foreground">
								搜索并替换音频源
							</h3>
							<p className="text-[11px] text-muted-foreground">
								当前歌曲：<span className="text-foreground font-semibold">{targetTrack.title}</span> - {targetTrack.artist?.name || '未知歌手'}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Search Bar */}
				<form
					onSubmit={(e) => {
						e.preventDefault()
						handleSearch(keyword)
					}}
					className="relative flex items-center gap-2"
				>
					<div className="relative flex-1">
						<Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
						<input
							type="text"
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							placeholder="输入歌曲名、歌手或 B 站 BV 号搜索替代版本..."
							className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
						/>
					</div>
					<button
						type="submit"
						disabled={loading || !keyword.trim()}
						className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
					>
						{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>搜索</span>}
					</button>
				</form>

				{/* Replaced Success State */}
				{replacedSuccessTrack ? (
					<div className="py-12 text-center space-y-3">
						<CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
						<p className="text-sm font-bold text-foreground">
							音频源已成功替换为该版本！
						</p>
					</div>
				) : (
					/* Results list */
					<div className="flex-1 overflow-y-auto no-scrollbar space-y-2 min-h-[260px] max-h-[380px] pr-1">
						{loading ? (
							<div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
								<Loader2 className="w-6 h-6 animate-spin text-primary" />
								<span className="text-xs">正在搜索 B 站候选版本...</span>
							</div>
						) : error ? (
							<div className="py-12 text-center text-rose-400 text-xs">{error}</div>
						) : results.length === 0 ? (
							<div className="py-12 text-center text-muted-foreground text-xs">
								未找到相关视频，可尝试精炼关键词或输入精准歌名再试
							</div>
						) : (
							results.map((video) => {
								let cover = video.pic || ''
								if (cover.startsWith('//')) cover = 'https:' + cover
								const cleanTitle = stripHtmlTags(video.title)

								return (
									<div
										key={video.bvid}
										className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 transition-all group"
									>
										<div className="flex items-center gap-3 flex-1 overflow-hidden mr-3">
											<div className="w-12 h-8 rounded-lg bg-black/40 overflow-hidden flex-shrink-0 relative">
												{cover && (
													<img
														src={cover}
														alt=""
														referrerPolicy="no-referrer"
														className="w-full h-full object-cover"
													/>
												)}
												<span className="absolute bottom-0.5 right-1 text-[9px] bg-black/70 px-1 rounded text-white/90 font-mono">
													{video.duration}
												</span>
											</div>

											<div className="overflow-hidden space-y-0.5 flex-1">
												<p
													className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate"
													title={cleanTitle}
												>
													{cleanTitle}
												</p>
												<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
													<span className="flex items-center gap-1 truncate max-w-[120px]">
														<User className="w-2.5 h-2.5" />
														{video.author}
													</span>
													<span>·</span>
													<span className="font-mono">{video.bvid}</span>
												</div>
											</div>
										</div>

										<button
											onClick={() => handleReplaceWith(video)}
											className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-semibold transition-colors flex-shrink-0"
										>
											替换为此版本
										</button>
									</div>
								)
							})
						)}
					</div>
				)}
			</div>
		</div>
	)
}
