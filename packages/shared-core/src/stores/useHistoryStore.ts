import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Track } from '../types/media'
import { getDefaultStateStorage } from './storage'

export interface PlayHistoryItem {
	id: string
	track: Track
	playedAt: number // Timestamp in milliseconds
	durationPlayed: number // In seconds
	completed: boolean
}

export interface HistoryStats {
	totalPlays: number
	todayPlays: number
	todayDurationMinutes: number
	matrix: number[][] // 7 days x 12 weeks
	maxCountPerDay: number
}

export interface HistoryState {
	records: PlayHistoryItem[]
	addRecord: (track: Track, durationPlayed?: number, completed?: boolean) => void
	removeRecord: (recordId: string) => void
	clearHistory: () => void
	getStats: () => HistoryStats
}

function deduplicateRecords(records: PlayHistoryItem[]): PlayHistoryItem[] {
	const seen = new Set<string>()
	const result: PlayHistoryItem[] = []
	for (const r of records) {
		const key =
			r.track.source === 'bilibili' && (r.track as any).bilibiliMetadata?.bvid
				? `bili_${(r.track as any).bilibiliMetadata.bvid}_${(r.track as any).bilibiliMetadata.cid || (r.track as any).bilibiliMetadata.pageIndex || 1}`
				: r.track.uniqueKey
		if (!seen.has(key)) {
			seen.add(key)
			result.push(r)
		}
	}
	return result
}

export const useHistoryStore = create<HistoryState>()(
	persist(
		(set, get) => ({
			records: [],

			addRecord: (track, durationPlayed = 0, completed = false) => {
				const now = Date.now()
				const newRecord: PlayHistoryItem = {
					id: `hist_${now}_${Math.random().toString(36).substring(2, 6)}`,
					track,
					playedAt: now,
					durationPlayed,
					completed,
				}

				set((state) => {
					// 严格去重：同一首歌只保留最新播放记录，并将最新收听置顶
					const deduplicated = deduplicateRecords([newRecord, ...state.records])
					// 最多保留 500 条收听记录
					return {
						records: deduplicated.slice(0, 500),
					}
				})
			},

			removeRecord: (recordId) => {
				set((state) => ({
					records: state.records.filter((r) => r.id !== recordId),
				}))
			},

			clearHistory: () => {
				set({ records: [] })
			},

			getStats: () => {
				const { records } = get()
				const now = new Date()
				const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

				const todayRecords = records.filter((r) => r.playedAt >= todayStart)
				const todayPlays = todayRecords.length
				const todayDurationMinutes = Math.round(
					todayRecords.reduce((acc, r) => acc + (r.durationPlayed || r.track.duration || 180), 0) / 60,
				)

				// 计算 12 周 x 7 天热力图矩阵
				// 列 0 为 11 周前，列 11 为本周；行 0~6 分别为周一至周日
				const weeks = 12
				const days = 7
				const matrix = Array.from({ length: days }, () => Array.from({ length: weeks }, () => 0))

				// 当前周的星期几 (0: 周日, 1~6: 周一~周六)
				const currentDayOfWeek = now.getDay() // 0 is Sunday
				const currentDayIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1 // 0=Mon, ..., 6=Sun

				let maxCount = 0

				records.forEach((r) => {
					const rDate = new Date(r.playedAt)
					const diffDays = Math.floor((todayStart - new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate()).getTime()) / 86400000)
					if (diffDays >= 0 && diffDays < weeks * 7) {
						// 计算距今天落在第几周与星期几
						const totalDayOffset = (weeks - 1) * 7 + currentDayIndex - diffDays
						if (totalDayOffset >= 0 && totalDayOffset < weeks * 7) {
							const w = Math.floor(totalDayOffset / 7)
							const d = totalDayOffset % 7
							if (w >= 0 && w < weeks && d >= 0 && d < days) {
								matrix[d]![w]! += 1
								if (matrix[d]![w]! > maxCount) {
									maxCount = matrix[d]![w]!
								}
							}
						}
					}
				})

				return {
					totalPlays: records.length,
					todayPlays,
					todayDurationMinutes,
					matrix,
					maxCountPerDay: maxCount,
				}
			},
		}),
		{
			name: 'bbplayer_play_history',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			merge: (persistedState: any, currentState: HistoryState) => {
				const records = Array.isArray(persistedState?.records)
					? deduplicateRecords(persistedState.records).slice(0, 500)
					: currentState.records
				return {
					...currentState,
					...persistedState,
					records,
				}
			},
		},
	),
)
