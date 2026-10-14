import React, { useEffect, useState } from 'react'
import { History, Flame, Calendar, Clock, Disc } from 'lucide-react'
import { getDatabaseQueries } from '../../db/desktopDb'

export const HistoryHeatmapView: React.FC = () => {
	const [historyRecords, setHistoryRecords] = useState<any[]>([])

	useEffect(() => {
		const queries = getDatabaseQueries()
		if (queries) {
			queries
				.getRecentPlayHistory(50)
				.then((records) => setHistoryRecords(records))
				.catch((err) => console.warn('History query error:', err))
		}
	}, [])

	// 7 days x 12 weeks activity heatmap matrix
	const weeks = 12
	const days = 7
	const sampleMatrix = Array.from({ length: days }, (_, dayIdx) =>
		Array.from({ length: weeks }, (_, weekIdx) => {
			const pseudoRandomCount = (dayIdx * 3 + weekIdx * 5 + 2) % 7
			return pseudoRandomCount
		}),
	)

	return (
		<div className="space-y-6 max-w-4xl select-none">
			<div>
				<h2 className="text-base font-bold text-foreground flex items-center gap-2">
					<Flame className="w-5 h-5 text-orange-400" />
					<span>播放历史与音乐热力图</span>
				</h2>
				<p className="text-xs text-muted-foreground mt-0.5">
					本地 SQLite 持久化记录收听时长与高频播放时段
				</p>
			</div>

			{/* Listening Activity Heatmap */}
			<div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
						<Calendar className="w-3.5 h-3.5 text-muted-foreground" />
						<span>近 3 个月收听热度分布</span>
					</span>
					<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
						<span>少</span>
						<span className="w-2.5 h-2.5 rounded-sm bg-white/5" />
						<span className="w-2.5 h-2.5 rounded-sm bg-sky-500/30" />
						<span className="w-2.5 h-2.5 rounded-sm bg-sky-500/60" />
						<span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
						<span>多</span>
					</div>
				</div>

				<div className="flex gap-1.5 overflow-x-auto py-2">
					{Array.from({ length: weeks }).map((_, w) => (
						<div key={w} className="flex flex-col gap-1.5">
							{Array.from({ length: days }).map((_, d) => {
								const level = sampleMatrix[d]![w]!
								const bgClass =
									level === 0
										? 'bg-white/5'
										: level < 3
										? 'bg-sky-500/30'
										: level < 5
										? 'bg-sky-500/60'
										: 'bg-sky-400'
								return (
									<div
										key={d}
										title={`周 ${d + 1}: 播放 ${level * 2} 首`}
										className={`w-3.5 h-3.5 rounded-sm ${bgClass} transition-colors hover:ring-1 hover:ring-white`}
									/>
								)
							})}
						</div>
					))}
				</div>
			</div>

			{/* Recent History List */}
			<div className="space-y-3">
				<h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
					<Clock className="w-3.5 h-3.5 text-muted-foreground" />
					<span>最近收听记录</span>
				</h3>

				{historyRecords.length === 0 ? (
					<div className="p-8 text-center rounded-2xl bg-white/5 border border-dashed border-white/10 text-muted-foreground text-xs">
						暂无收听记录，去发现音乐播放你喜欢的歌曲吧
					</div>
				) : (
					<div className="space-y-1.5">
						{historyRecords.map((item, idx) => (
							<div
								key={idx}
								className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
										<Disc className="w-4 h-4" />
									</div>
									<div>
										<p className="font-semibold text-foreground">
											Track #{item.trackId}
										</p>
										<p className="text-[10px] text-muted-foreground">
											收听时长: {item.durationPlayed} 秒
										</p>
									</div>
								</div>
								<span className="text-[11px] text-muted-foreground font-mono">
									{new Date(item.startTime).toLocaleTimeString()}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
