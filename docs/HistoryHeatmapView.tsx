import React, { useMemo } from 'react'
import {
	History,
	Flame,
	Calendar,
	Clock,
	Play,
	Music,
	Trash2,
	TrendingUp,
	Headphones,
} from 'lucide-react'
import { useHistoryStore, useQueueStore, type Track } from '@bbplayer/shared-core'
import { playTrackWithProxy } from '../../audio/playTrackHelper'

function formatRelativeTime(timestamp: number): string {
	const now = Date.now()
	const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))

	if (diffSec < 60) return '刚刚'
	const diffMin = Math.floor(diffSec / 60)
	if (diffMin < 60) return `${diffMin} 分钟前`
	const diffHour = Math.floor(diffMin / 60)
	if (diffHour < 24) return `${diffHour} 小时前`
	const diffDay = Math.floor(diffHour / 24)
	if (diffDay === 1) return '昨天'
	if (diffDay < 7) return `${diffDay} 天前`

	const d = new Date(timestamp)
	return `${d.getMonth() + 1}月${d.getDate()}日`
}

export const HistoryHeatmapView: React.FC = () => {
	const { records, clearHistory, getStats } = useHistoryStore()
	const { setQueue } = useQueueStore()

	const stats = useMemo(() => getStats(), [records, getStats])

	const handlePlayTrack = async (track: Track, idx: number) => {
		const tracks = records.map((r) => r.track)
		setQueue(tracks, idx)
		try {
			await playTrackWithProxy(track)
		} catch (err) {
			console.error('Play history track failed:', err)
		}
	}

	const handleClearHistory = () => {
		if (window.confirm('确定要清空所有收听历史记录吗？')) {
			clearHistory()
		}
	}

	const dayLabels = ['一', '二', '三', '四', '五', '六', '日']

	return (
		<div className="space-y-6 max-w-4xl select-none">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-base font-bold text-foreground flex items-center gap-2">
						<Flame className="w-5 h-5 text-orange-400" />
						<span>播放历史与音乐热力图</span>
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						本地持久化记录收听足迹与多维热度统计
					</p>
				</div>

				{records.length > 0 && (
					<button
						onClick={handleClearHistory}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 text-xs transition-colors"
					>
						<Trash2 className="w-3.5 h-3.5" />
						<span>清空记录</span>
					</button>
				)}
			</div>

			{/* Top Metric Cards */}
			<div className="grid grid-cols-3 gap-3">
				<div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<Headphones className="w-3.5 h-3.5 text-sky-400" />
						<span>今日播放</span>
					</div>
					<p className="text-xl font-bold text-foreground">
						{stats.todayPlays}{' '}
						<span className="text-xs font-normal text-muted-foreground">首</span>
					</p>
				</div>

				<div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<Clock className="w-3.5 h-3.5 text-emerald-400" />
						<span>今日收听时长</span>
					</div>
					<p className="text-xl font-bold text-foreground">
						{stats.todayDurationMinutes}{' '}
						<span className="text-xs font-normal text-muted-foreground">分钟</span>
					</p>
				</div>

				<div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<TrendingUp className="w-3.5 h-3.5 text-primary" />
						<span>累计收听曲目</span>
					</div>
					<p className="text-xl font-bold text-foreground">
						{stats.totalPlays}{' '}
						<span className="text-xs font-normal text-muted-foreground">首</span>
					</p>
				</div>
			</div>

			{/* Listening Activity Heatmap */}
			<div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
						<Calendar className="w-3.5 h-3.5 text-muted-foreground" />
						<span>近 3 个月收听热度分布</span>
					</span>
					<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
						<span>无</span>
						<span className="w-2.5 h-2.5 rounded-sm bg-white/5" />
						<span className="w-2.5 h-2.5 rounded-sm bg-sky-500/30" />
						<span className="w-2.5 h-2.5 rounded-sm bg-sky-500/60" />
						<span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
						<span>频繁</span>
					</div>
				</div>

				<div className="flex items-center gap-2 overflow-x-auto py-2">
					<div className="flex flex-col gap-1.5 text-[9px] text-muted-foreground pr-1 font-mono">
						{dayLabels.map((label, idx) => (
							<span key={idx} className="h-3.5 leading-[14px]">
								{label}
							</span>
						))}
					</div>

					<div className="flex gap-1.5">
						{Array.from({ length: 12 }).map((_, w) => (
							<div key={w} className="flex flex-col gap-1.5">
								{Array.from({ length: 7 }).map((_, d) => {
									const count = stats.matrix[d]?.[w] || 0
									const bgClass =
										count === 0
											? 'bg-white/5'
											: count <= 2
											? 'bg-sky-500/30'
											: count <= 5
											? 'bg-sky-500/60'
											: 'bg-sky-400 shadow-sm shadow-sky-400/30'

									return (
										<div
											key={d}
											title={`周${dayLabels[d]}: 播放 ${count} 首歌曲`}
											className={`w-3.5 h-3.5 rounded-sm ${bgClass} transition-colors hover:ring-1 hover:ring-white`}
										/>
									)
								})}
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Recent History List */}
			<div className="space-y-3">
				<h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
					<Clock className="w-3.5 h-3.5 text-muted-foreground" />
					<span>最近收听记录（共 {records.length} 首）</span>
				</h3>

				{records.length === 0 ? (
					<div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-muted-foreground space-y-2">
						<Music className="w-8 h-8 mx-auto opacity-30" />
						<p className="text-xs">
							暂无收听记录，去发现音乐播放你喜欢的歌曲吧
						</p>
					</div>
				) : (
					<div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
						{records.map((item, idx) => (
							<div
								key={item.id}
								onClick={() => handlePlayTrack(item.track, idx)}
								className="group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 text-xs transition-all cursor-pointer"
							>
								<div className="flex items-center gap-3 overflow-hidden mr-3">
									<div className="relative w-10 h-10 rounded-lg overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center">
										{item.track.coverUrl ? (
											<img
												src={item.track.coverUrl}
												alt=""
												referrerPolicy="no-referrer"
												className="w-full h-full object-cover group-hover:scale-105 transition-transform"
											/>
										) : (
											<Music className="w-4 h-4 text-white/30" />
										)}
										<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
											<Play className="w-4 h-4 text-white fill-current" />
										</div>
									</div>

									<div className="overflow-hidden space-y-0.5">
										<p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
											{item.track.title}
										</p>
										<p className="text-[11px] text-muted-foreground truncate">
											{item.track.artist?.name || '未知歌手'}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-3 flex-shrink-0 text-right">
									<span className="text-[11px] text-muted-foreground font-mono">
										{formatRelativeTime(item.playedAt)}
									</span>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
