import React, { useState, useMemo } from 'react'
import {
	Flame,
	Calendar,
	Clock,
	Play,
	Music,
	Trash2,
	TrendingUp,
	Headphones,
	ChevronDown,
	ChevronUp,
	Eye,
	EyeOff,
	CalendarDays,
} from 'lucide-react'
import { useHistoryStore, useQueueStore, type Track, type PlayHistoryItem } from '@bbplayer/shared-core'
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

function getDayKey(timestamp: number): string {
	const d = new Date(timestamp)
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

function getDayLabel(
	dateKey: string,
	todayKey: string,
	yesterdayKey: string,
	beforeYesterdayKey: string,
): string {
	const [y, m, d] = dateKey.split('-').map(Number)
	const dateObj = new Date(y, m - 1, d)
	const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
	const weekDayStr = weekDays[dateObj.getDay()]

	if (dateKey === todayKey) {
		return `今天 · ${m}月${d}日 (${weekDayStr})`
	}
	if (dateKey === yesterdayKey) {
		return `昨天 · ${m}月${d}日 (${weekDayStr})`
	}
	if (dateKey === beforeYesterdayKey) {
		return `前天 · ${m}月${d}日 (${weekDayStr})`
	}
	return `${y}年${m}月${d}日 · ${weekDayStr}`
}

export interface DayGroup {
	dateKey: string
	label: string
	items: { record: PlayHistoryItem; originalIndex: number }[]
	totalCount: number
}

export const HistoryHeatmapView: React.FC = () => {
	const { records, clearHistory, getStats } = useHistoryStore()
	const { setQueue } = useQueueStore()

	const stats = useMemo(() => getStats(), [records, getStats])

	// 选中的热力图日期及临时高亮定位的日期
	const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
	const [highlightedDayKey, setHighlightedDayKey] = useState<string | null>(null)
	const [toastMsg, setToastMsg] = useState<string | null>(null)

	// 最近收听记录是否隐藏折叠 (持久化)
	const [isHistoryHidden, setIsHistoryHidden] = useState<boolean>(() => {
		try {
			return localStorage.getItem('bbplayer_hide_history_list') === 'true'
		} catch {
			return false
		}
	})

	const toggleHistoryHidden = () => {
		setIsHistoryHidden((prev) => {
			const next = !prev
			try {
				localStorage.setItem('bbplayer_hide_history_list', String(next))
			} catch {}
			return next
		})
	}

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

	// 日期计算基准
	const now = new Date()
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
	const todayKey = getDayKey(now.getTime())
	const yesterdayKey = getDayKey(now.getTime() - 86400000)
	const beforeYesterdayKey = getDayKey(now.getTime() - 86400000 * 2)

	// 当前周在矩阵中的 dayIndex (0: 周一, ..., 6: 周日)
	const currentDayOfWeek = now.getDay()
	const currentDayIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1

	// 将历史记录按自然日聚合分类
	const dayGroups = useMemo<DayGroup[]>(() => {
		const groupsMap = new Map<string, { record: PlayHistoryItem; originalIndex: number }[]>()
		records.forEach((record, originalIndex) => {
			const key = getDayKey(record.playedAt)
			if (!groupsMap.has(key)) {
				groupsMap.set(key, [])
			}
			groupsMap.get(key)!.push({ record, originalIndex })
		})

		const result: DayGroup[] = []
		for (const [dateKey, items] of groupsMap.entries()) {
			result.push({
				dateKey,
				label: getDayLabel(dateKey, todayKey, yesterdayKey, beforeYesterdayKey),
				items,
				totalCount: items.length,
			})
		}
		// 最新日期在前
		return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
	}, [records, todayKey, yesterdayKey, beforeYesterdayKey])

	// 计算热力图每个格子的实际年月日及状态
	const getCellInfo = (d: number, w: number) => {
		const weeks = 12
		const totalDayOffset = (weeks - 1) * 7 + currentDayIndex
		const cellOffset = w * 7 + d
		const diffDays = totalDayOffset - cellOffset
		const isFuture = diffDays < 0
		const cellTime = todayStart - diffDays * 86400000
		const dateObj = new Date(cellTime)
		const y = dateObj.getFullYear()
		const m = String(dateObj.getMonth() + 1).padStart(2, '0')
		const day = String(dateObj.getDate()).padStart(2, '0')
		const dateKey = `${y}-${m}-${day}`
		const dateStr = `${y}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`
		return { dateKey, dateStr, isFuture, diffDays }
	}

	// 点击热力图格子跳转到对应日期的收听记录
	const handleCellClick = (d: number, w: number) => {
		const cell = getCellInfo(d, w)
		if (cell.isFuture) return

		setSelectedDateKey(cell.dateKey)
		// 如果记录列表当前被隐藏折叠，自动展开它以展示目标日期的歌曲
		setIsHistoryHidden(false)

		const groupExists = dayGroups.some((g) => g.dateKey === cell.dateKey)
		if (groupExists) {
			setHighlightedDayKey(cell.dateKey)
			setTimeout(() => {
				const el = document.getElementById(`day-group-${cell.dateKey}`)
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center' })
				}
			}, 60)
			// 2秒后清除发光高亮提示
			setTimeout(() => {
				setHighlightedDayKey((prev) => (prev === cell.dateKey ? null : prev))
			}, 2200)
		} else {
			setToastMsg(`${cell.dateStr} 暂无收听记录`)
			setTimeout(() => {
				setToastMsg(null)
			}, 2500)
		}
	}

	return (
		<div className="space-y-6 max-w-4xl select-none relative pb-12">
			{/* Toast 提示浮窗 */}
			{toastMsg && (
				<div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-black/85 border border-white/20 text-white text-xs shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
					<CalendarDays className="w-4 h-4 text-sky-400" />
					<span>{toastMsg}</span>
				</div>
			)}

			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-base font-bold text-foreground flex items-center gap-2">
						<Flame className="w-5 h-5 text-orange-400" />
						<span>播放历史与音乐热力图</span>
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						本地持久化记录收听足迹、多维热度统计与按天归档
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
						<span>累计播放次数</span>
					</div>
					<p className="text-xl font-bold text-foreground">
						{stats.totalPlayCount}{' '}
						<span className="text-xs font-normal text-muted-foreground">次 ({stats.totalPlays} 首)</span>
					</p>
				</div>
			</div>

			{/* Listening Activity Heatmap */}
			<div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
						<Calendar className="w-3.5 h-3.5 text-muted-foreground" />
						<span>近 3 个月收听热度分布</span>
						<span className="text-[10px] text-muted-foreground/60 font-normal ml-1">
							(点击任意日期跳转至当天记录)
						</span>
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
									const cell = getCellInfo(d, w)
									const isSelected = selectedDateKey === cell.dateKey

									const bgClass = cell.isFuture
										? 'opacity-20 bg-white/5 cursor-not-allowed'
										: count === 0
										? 'bg-white/5 cursor-pointer hover:bg-white/20'
										: count <= 2
										? 'bg-sky-500/30 cursor-pointer hover:bg-sky-500/50'
										: count <= 5
										? 'bg-sky-500/60 cursor-pointer hover:bg-sky-500/80'
										: 'bg-sky-400 shadow-sm shadow-sky-400/30 cursor-pointer hover:bg-sky-300'

									const ringClass = isSelected
										? 'ring-2 ring-primary ring-offset-1 ring-offset-[#07090e] scale-110 z-10'
										: 'hover:ring-1 hover:ring-white/80'

									return (
										<div
											key={d}
											onClick={() => handleCellClick(d, w)}
											title={
												cell.isFuture
													? '未来日期'
													: `${cell.dateStr} (周${dayLabels[d]}): 播放 ${count} 首歌曲 (点击跳转)`
											}
											className={`w-3.5 h-3.5 rounded-sm ${bgClass} ${ringClass} transition-all duration-150`}
										/>
									)
								})}
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Recent History Section (可折叠隐藏，按自然日分组) */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-bold text-foreground flex items-center gap-2">
						<Clock className="w-3.5 h-3.5 text-muted-foreground" />
						<span>最近收听记录（共 {records.length} 首）</span>
						{dayGroups.length > 0 && (
							<span className="text-[11px] font-normal text-muted-foreground/70">
								· 分布在 {dayGroups.length} 个自然日
							</span>
						)}
					</h3>

					{/* 隐藏 / 展开切换按钮 */}
					<button
						onClick={toggleHistoryHidden}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs transition-colors"
						title={isHistoryHidden ? '展开最近收听记录' : '隐藏最近收听记录'}
					>
						{isHistoryHidden ? (
							<>
								<Eye className="w-3.5 h-3.5 text-primary" />
								<span>展开记录</span>
								<ChevronDown className="w-3.5 h-3.5" />
							</>
						) : (
							<>
								<EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
								<span>隐藏记录</span>
								<ChevronUp className="w-3.5 h-3.5" />
							</>
						)}
					</button>
				</div>

				{records.length === 0 ? (
					<div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-muted-foreground space-y-2">
						<Music className="w-8 h-8 mx-auto opacity-30" />
						<p className="text-xs">
							暂无收听记录，去发现音乐播放你喜欢的歌曲吧
						</p>
					</div>
				) : isHistoryHidden ? (
					<div
						onClick={toggleHistoryHidden}
						className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 text-muted-foreground space-y-1.5 cursor-pointer transition-colors"
					>
						<p className="text-xs font-medium text-foreground/80 flex items-center justify-center gap-2">
							<EyeOff className="w-4 h-4 text-muted-foreground" />
							<span>最近收听记录已隐藏</span>
						</p>
						<p className="text-[11px] text-muted-foreground/60">
							共 {records.length} 首歌曲 · 点击此处或上方按钮即可展开查看
						</p>
					</div>
				) : (
					/* 按天分类的分组卡片列表 */
					<div className="space-y-5">
						{dayGroups.map((group) => {
							const isHighlighted = highlightedDayKey === group.dateKey
							return (
								<div
									key={group.dateKey}
									id={`day-group-${group.dateKey}`}
									className={`rounded-2xl p-4 border transition-all duration-500 ${
										isHighlighted
											? 'bg-primary/10 border-primary ring-2 ring-primary/50 shadow-lg shadow-primary/20 scale-[1.01]'
											: 'bg-white/[0.02] border-white/5'
									}`}
								>
									{/* 天分类 Header */}
									<div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
										<div className="flex items-center gap-2">
											<CalendarDays className={`w-4 h-4 ${isHighlighted ? 'text-primary' : 'text-sky-400'}`} />
											<span className="text-xs font-bold text-foreground">
												{group.label}
											</span>
										</div>
										<span className="text-[11px] font-mono text-muted-foreground/70">
											{group.totalCount} 首音乐
										</span>
									</div>

									{/* 歌曲列表 */}
									<div className="space-y-1.5">
										{group.items.map(({ record: item, originalIndex }) => (
											<div
												key={item.id}
												onClick={() => handlePlayTrack(item.track, originalIndex)}
												className="group flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.08] border border-transparent hover:border-white/10 text-xs transition-all cursor-pointer"
											>
												<div className="flex items-center gap-3 overflow-hidden mr-3">
													<div className="relative w-9 h-9 rounded-lg overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center">
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
															<Play className="w-3.5 h-3.5 text-white fill-current" />
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

												<div className="flex items-center gap-2.5 flex-shrink-0 text-right">
													<span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#00AEEC]/10 text-[#00AEEC] border border-[#00AEEC]/20 font-mono font-medium">
														播放 {item.playCount || 1} 次
													</span>
													<span className="text-[10px] text-muted-foreground font-mono">
														{formatRelativeTime(item.playedAt)}
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
