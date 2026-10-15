import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Layers, Play, Plus, Loader2, Music2 } from 'lucide-react'
import {
	bilibiliApi,
	useQueueStore,
	useCurrentTrack,
	type BilibiliTrack,
	type BilibiliVideoPart,
} from '@bbplayer/shared-core'
import { playTrackWithProxy } from '../../audio/playTrackHelper'

export interface VideoPartsModalProps {
	isOpen: boolean
	onClose: () => void
	bvid: string
	title: string
	coverUrl?: string | null
	author?: string
	currentCid?: number | null
	currentPage?: number
	initialParts?: BilibiliVideoPart[]
}

function formatDuration(seconds: number): string {
	if (!seconds || isNaN(seconds)) return '00:00'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const VideoPartsModal: React.FC<VideoPartsModalProps> = ({
	isOpen,
	onClose,
	bvid,
	title,
	coverUrl,
	author,
	currentCid,
	currentPage,
	initialParts,
}) => {
	const [parts, setParts] = useState<BilibiliVideoPart[]>(initialParts || [])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const { addTrack, setQueue } = useQueueStore()

	const loadParts = async (cancelledCheck?: () => boolean) => {
		setLoading(true)
		setError(null)
		try {
			const res = await bilibiliApi.getPageList({ bvid })
			if (cancelledCheck && cancelledCheck()) return
			if (res.isOk()) {
				const mapped = res.value.map((p) => ({
					cid: p.cid,
					page: p.page,
					part: p.part || `第${p.page}部分`,
					duration: p.duration,
				}))
				setParts(mapped)
			} else {
				setError('获取分 P 列表失败: ' + res.error.message)
			}
		} catch (err: any) {
			if (cancelledCheck && cancelledCheck()) return
			setError('网络异常: ' + String(err))
		} finally {
			if (!cancelledCheck || !cancelledCheck()) {
				setLoading(false)
			}
		}
	}

	useEffect(() => {
		if (!isOpen || !bvid) return

		if (initialParts && initialParts.length > 0) {
			setParts(initialParts)
			return
		}

		let isCancelled = false
		loadParts(() => isCancelled)

		return () => {
			isCancelled = true
		}
	}, [isOpen, bvid, initialParts])

	if (!isOpen) return null

	const createTrackFromPart = (part: BilibiliVideoPart): BilibiliTrack => {
		const partTitle = part.part || `第${part.page}部分`

		return {
			id: Date.now() + part.page,
			uniqueKey: `bilibili_${bvid}_${part.page}`,
			title: partTitle,
			artist: {
				id: 1,
				name: author || 'B站音乐',
				source: 'bilibili',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			coverUrl: coverUrl || 'https://i0.hdslb.com/bfs/archive/placeholder.jpg',
			duration: part.duration || 180,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid,
				cid: part.cid,
				isMultiPage: parts.length > 1,
				videoIsValid: true,
				mainTrackTitle: title,
				pageIndex: part.page,
				pagePart: part.part,
				pages: parts,
			},
		}
	}

	const queueCurrentTrack = useCurrentTrack()
	const activeBiliTrack =
		queueCurrentTrack &&
		queueCurrentTrack.source === 'bilibili' &&
		(queueCurrentTrack as BilibiliTrack).bilibiliMetadata.bvid === bvid
			? (queueCurrentTrack as BilibiliTrack)
			: null

	const effectiveCid = activeBiliTrack ? activeBiliTrack.bilibiliMetadata.cid : currentCid
	const effectivePage = activeBiliTrack
		? activeBiliTrack.bilibiliMetadata.pageIndex
		: currentPage

	const handlePlaySinglePart = async (part: BilibiliVideoPart) => {
		const track = createTrackFromPart(part)
		const { queue, currentIndex } = useQueueStore.getState()

		// 1. Check if this exact part is already in queue
		const existingIdx = queue.findIndex((t) => t.uniqueKey === track.uniqueKey)
		if (existingIdx !== -1) {
			useQueueStore.getState().setCurrentIndex(existingIdx)
		} else {
			// If currently playing track is another part of this same video, replace it in-place
			const currentT = currentIndex >= 0 ? queue[currentIndex] : null
			const isSameBvid =
				currentT &&
				currentT.source === 'bilibili' &&
				(currentT as BilibiliTrack).bilibiliMetadata.bvid === bvid

			if (isSameBvid && currentIndex >= 0) {
				const newQueue = [...queue]
				newQueue[currentIndex] = track
				useQueueStore.setState({ queue: newQueue })
			} else {
				addTrack(track, true)
				const targetIdx = currentIndex >= 0 ? currentIndex + 1 : 0
				useQueueStore.getState().setCurrentIndex(targetIdx)
			}
		}

		try {
			await playTrackWithProxy(track, true)
		} catch (err) {
			console.error('播放分 P 失败:', err)
		}
		onClose()
	}

	const handlePlayAllParts = async () => {
		if (parts.length === 0) return
		const allTracks = parts.map((p) => createTrackFromPart(p))
		setQueue(allTracks, 0)
		try {
			await playTrackWithProxy(allTracks[0]!, true)
		} catch (err) {
			console.error('播放全部失败:', err)
		}
		onClose()
	}

	const handleAppendAllParts = () => {
		if (parts.length === 0) return
		parts.forEach((p) => {
			addTrack(createTrackFromPart(p), false)
		})
		onClose()
	}

	return createPortal(
		<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-lg max-h-[85vh] rounded-2xl bg-[#0e131f]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-5 space-y-4 text-xs">
				{/* Top Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/10">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-[#00AEEC]/15 border border-[#00AEEC]/30 flex items-center justify-center text-[#00AEEC]">
							<Layers className="w-4 h-4" />
						</div>
						<div>
							<h3 className="font-bold text-sm text-foreground">
								视频分 P 选集
							</h3>
							<p className="text-[11px] text-muted-foreground">
								{loading ? '正在识别分 P 数据...' : `共检测到 ${parts.length} 个分 P 章节`}
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Video Brief Header */}
				<div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
					{coverUrl && (
						<img
							src={coverUrl}
							alt=""
							referrerPolicy="no-referrer"
							className="w-16 h-10 rounded-lg object-cover flex-shrink-0"
						/>
					)}
					<div className="flex-1 min-w-0">
						<p className="font-semibold text-foreground truncate text-xs" title={title}>
							{title}
						</p>
						<p className="text-[11px] text-muted-foreground truncate">
							{author || '未知UP主'} · BV: {bvid}
						</p>
					</div>
				</div>

				{/* Batch Action Buttons */}
				{parts.length > 1 && (
					<div className="flex items-center gap-2">
						<button
							onClick={handlePlayAllParts}
							className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#00AEEC] hover:bg-[#1dbefa] text-white font-semibold transition-all shadow-md shadow-[#00AEEC]/20 active:scale-95"
						>
							<Play className="w-3.5 h-3.5 fill-current" />
							<span>播放全部分 P (共 {parts.length} 首)</span>
						</button>
						<button
							onClick={handleAppendAllParts}
							className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-medium transition-all"
							title="将全部分 P 追加到当前播放队列末尾"
						>
							<Plus className="w-3.5 h-3.5" />
							<span>追加全部</span>
						</button>
					</div>
				)}

				{/* Content List */}
				<div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1 min-h-[160px] max-h-[380px]">
					{loading ? (
						<div className="py-16 flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
							<Loader2 className="w-5 h-5 animate-spin text-[#00AEEC]" />
							<span className="text-[11px]">正在解析分 P 列表，请稍候...</span>
						</div>
					) : error ? (
						<div className="py-12 text-center text-rose-400 space-y-2">
							<p>{error}</p>
							<button
								onClick={() => loadParts()}
								className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs"
							>
								重试
							</button>
						</div>
					) : parts.length === 0 ? (
						<div className="py-12 text-center text-muted-foreground">
							未检测到分 P 内容
						</div>
					) : (
						parts.map((p) => {
							const isCurrent =
								(effectiveCid && p.cid === effectiveCid) ||
								(effectivePage && p.page === effectivePage)

							return (
								<div
									key={p.cid || p.page}
									onClick={() => handlePlaySinglePart(p)}
									className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
										isCurrent
											? 'bg-[#00AEEC]/15 border-[#00AEEC]/40 text-[#00AEEC]'
											: 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10 text-foreground'
									}`}
								>
									<div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
										<span
											className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
												isCurrent
													? 'bg-[#00AEEC] text-white'
													: 'bg-white/5 text-muted-foreground group-hover:text-foreground'
											}`}
										>
											P{p.page}
										</span>
										<span
											className="truncate font-medium text-xs group-hover:text-[#00AEEC] transition-colors"
											title={p.part}
										>
											{p.part}
										</span>
									</div>

									<div className="flex items-center gap-2 flex-shrink-0">
										{isCurrent && (
											<span className="flex items-center gap-1 text-[10px] text-[#00AEEC] font-semibold animate-pulse">
												<Music2 className="w-3 h-3" />
												<span>正在播放</span>
											</span>
										)}
										<span className="text-[11px] text-muted-foreground/70 font-mono">
											{formatDuration(p.duration)}
										</span>
										<div className="w-6 h-6 rounded-lg bg-white/5 group-hover:bg-[#00AEEC] group-hover:text-white flex items-center justify-center text-muted-foreground transition-colors ml-1">
											<Play className="w-3 h-3 fill-current ml-0.5" />
										</div>
									</div>
								</div>
							)
						})
					)}
				</div>
			</div>
		</div>,
		document.body,
	)
}
