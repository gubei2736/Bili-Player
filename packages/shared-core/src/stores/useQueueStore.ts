import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Track, BilibiliTrack } from '../types/media'
import { getDefaultStateStorage } from './storage'

export type PlayMode = 'sequential' | 'shuffle' | 'repeat_one' | 'repeat_all'

export interface QueueState {
	queue: Track[]
	currentIndex: number
	currentTrack: Track | null
	playMode: PlayMode
	shuffledIndices: number[]

	setQueue: (tracks: Track[], startIndex?: number) => void
	addTrack: (track: Track, playNext?: boolean) => void
	playOrReplacePartTrack: (track: BilibiliTrack) => void
	removeTrack: (index: number) => void
	clearQueue: () => void
	setCurrentIndex: (index: number) => void
	updateTrackStream: (
		uniqueKey: string,
		streamUrlData: NonNullable<BilibiliTrack['bilibiliMetadata']['bilibiliStreamUrl']>,
		extraMetadata?: Partial<BilibiliTrack['bilibiliMetadata']>,
		trackOverrides?: Partial<Pick<BilibiliTrack, 'title' | 'duration' | 'uniqueKey'>>,
	) => void
	next: () => Track | null
	prev: () => Track | null
	setPlayMode: (mode: PlayMode) => void
	getCurrentTrack: () => Track | null
}

function generateShuffleIndices(length: number): number[] {
	const indices = Array.from({ length }, (_, i) => i)
	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = indices[i]!
		indices[i] = indices[j]!
		indices[j] = temp
	}
	return indices
}

function cloneTrack(track: Track | null | undefined): Track | null {
	if (!track) return null
	if (track.source === 'bilibili') {
		const bt = track as BilibiliTrack
		return {
			...bt,
			bilibiliMetadata: {
				...bt.bilibiliMetadata,
			},
		}
	}
	return { ...track }
}

export const useQueueStore = create<QueueState>()(
	persist(
		(set, get) => ({
			queue: [],
			currentIndex: -1,
			currentTrack: null,
			playMode: 'sequential',
			shuffledIndices: [],

			setQueue: (tracks, startIndex = 0) => {
				const validIndex =
					tracks.length > 0
						? Math.max(0, Math.min(startIndex, tracks.length - 1))
						: -1

				const clonedQueue = tracks.map((t) => cloneTrack(t)!)
				const active = validIndex >= 0 ? cloneTrack(clonedQueue[validIndex]) : null

				const shuffled =
					get().playMode === 'shuffle'
						? generateShuffleIndices(clonedQueue.length)
						: []

				set({
					queue: clonedQueue,
					currentIndex: validIndex,
					currentTrack: active,
					shuffledIndices: shuffled,
				})
			},

			addTrack: (track, playNext = false) => {
				const { queue, currentIndex } = get()
				const cloned = cloneTrack(track)!
				const existingIndex = queue.findIndex(
					(t) => t.uniqueKey === cloned.uniqueKey,
				)

				if (existingIndex !== -1) {
					// Already in queue
					if (playNext && existingIndex !== currentIndex) {
						const newQueue = [...queue]
						const [removed] = newQueue.splice(existingIndex, 1)
						if (removed) {
							const adjCurrent =
								existingIndex < currentIndex ? currentIndex - 1 : currentIndex
							const insertPos =
								adjCurrent >= 0 ? adjCurrent + 1 : newQueue.length
							newQueue.splice(insertPos, 0, { ...removed, ...cloned })
							set({
								queue: newQueue,
								currentIndex: adjCurrent,
								currentTrack:
									adjCurrent >= 0 ? cloneTrack(newQueue[adjCurrent]) : null,
							})
						}
					}
					return
				}

				const newQueue = [...queue]
				if (playNext && currentIndex >= 0) {
					newQueue.splice(currentIndex + 1, 0, cloned)
				} else {
					newQueue.push(cloned)
				}

				const nextIndex = currentIndex === -1 ? 0 : currentIndex
				set({
					queue: newQueue,
					currentIndex: nextIndex,
					currentTrack:
						nextIndex >= 0 ? cloneTrack(newQueue[nextIndex]) : null,
					shuffledIndices:
						get().playMode === 'shuffle'
							? generateShuffleIndices(newQueue.length)
							: [],
				})
			},

			playOrReplacePartTrack: (track) => {
				const { queue, currentIndex, playMode } = get()
				const cloned = cloneTrack(track) as BilibiliTrack
				const bvid = cloned.bilibiliMetadata.bvid
				const targetCid = cloned.bilibiliMetadata.cid
				const targetPage = cloned.bilibiliMetadata.pageIndex

				// 1. 优先检查队列中是否已经有完全相同的分 P（按 uniqueKey 或 同 bvid + 同 cid/pageIndex 匹配）
				const exactIdx = queue.findIndex((t) => {
					if (t.uniqueKey === cloned.uniqueKey) return true
					if (t.source === 'bilibili') {
						const bt = t as BilibiliTrack
						if (bt.bilibiliMetadata.bvid === bvid) {
							if (targetCid && bt.bilibiliMetadata.cid === targetCid) return true
							if (targetPage && bt.bilibiliMetadata.pageIndex === targetPage)
								return true
						}
					}
					return false
				})

				if (exactIdx !== -1) {
					const newQueue = [...queue]
					newQueue[exactIdx] = cloned
					set({
						queue: newQueue,
						currentIndex: exactIdx,
						currentTrack: cloneTrack(cloned),
					})
					return
				}

				// 2. 如果当前正在播放的曲目属于同一个 bvid，直接原地将 queue[currentIndex] 替换为新选中的分 P！
				const currentT =
					currentIndex >= 0 && currentIndex < queue.length
						? queue[currentIndex]
						: null
				if (
					currentT &&
					currentT.source === 'bilibili' &&
					(currentT as BilibiliTrack).bilibiliMetadata.bvid === bvid
				) {
					const newQueue = [...queue]
					newQueue[currentIndex] = cloned
					set({
						queue: newQueue,
						currentIndex,
						currentTrack: cloneTrack(cloned),
					})
					return
				}

				// 3. 如果队列其他位置存在同一个 bvid 的条目，替换该位置并直接把 currentIndex 切过去
				const sameBvidIdx = queue.findIndex(
					(t) =>
						t.source === 'bilibili' &&
						(t as BilibiliTrack).bilibiliMetadata.bvid === bvid,
				)
				if (sameBvidIdx !== -1) {
					const newQueue = [...queue]
					newQueue[sameBvidIdx] = cloned
					set({
						queue: newQueue,
						currentIndex: sameBvidIdx,
						currentTrack: cloneTrack(cloned),
					})
					return
				}

				// 4. 队列中完全没有该 bvid，插入到 currentIndex + 1 并立即切换 currentIndex 和 currentTrack
				const newQueue = [...queue]
				const insertIdx =
					currentIndex >= 0 && currentIndex < newQueue.length
						? currentIndex + 1
						: newQueue.length
				newQueue.splice(insertIdx, 0, cloned)
				set({
					queue: newQueue,
					currentIndex: insertIdx,
					currentTrack: cloneTrack(cloned),
					shuffledIndices:
						playMode === 'shuffle'
							? generateShuffleIndices(newQueue.length)
							: [],
				})
			},

			removeTrack: (index) => {
				const { queue, currentIndex } = get()
				if (index < 0 || index >= queue.length) return

				const newQueue = queue.filter((_, i) => i !== index)
				let newIndex = currentIndex

				if (index < currentIndex) {
					newIndex--
				} else if (index === currentIndex) {
					newIndex = newQueue.length > 0 ? Math.min(currentIndex, newQueue.length - 1) : -1
				}

				set({
					queue: newQueue,
					currentIndex: newIndex,
					currentTrack:
						newIndex >= 0 && newIndex < newQueue.length
							? cloneTrack(newQueue[newIndex])
							: null,
					shuffledIndices:
						get().playMode === 'shuffle'
							? generateShuffleIndices(newQueue.length)
							: [],
				})
			},

			clearQueue: () => {
				set({
					queue: [],
					currentIndex: -1,
					currentTrack: null,
					shuffledIndices: [],
				})
			},

			setCurrentIndex: (index) => {
				const { queue } = get()
				if (index >= 0 && index < queue.length) {
					set({
						currentIndex: index,
						currentTrack: cloneTrack(queue[index]),
					})
				}
			},

			updateTrackStream: (uniqueKey, streamUrlData, extraMetadata, trackOverrides) => {
				set((state) => {
					const targetNewKey = trackOverrides?.uniqueKey
					let updated = false

					const newQueue = state.queue.map((t, idx) => {
						if (t.source !== 'bilibili') return t
						const bt = t as BilibiliTrack

						const isKeyMatch =
							t.uniqueKey === uniqueKey ||
							(targetNewKey !== undefined && t.uniqueKey === targetNewKey)

						const isTargetByMeta =
							extraMetadata?.pages &&
							extraMetadata?.bvid &&
							bt.bilibiliMetadata.bvid === extraMetadata.bvid &&
							(extraMetadata.cid ? bt.bilibiliMetadata.cid === extraMetadata.cid : true) &&
							(extraMetadata.pageIndex ? bt.bilibiliMetadata.pageIndex === extraMetadata.pageIndex : true)

						const isCurrentBvidMatch =
							idx === state.currentIndex &&
							extraMetadata?.bvid !== undefined &&
							bt.bilibiliMetadata.bvid === extraMetadata.bvid

						if (!isKeyMatch && !isTargetByMeta && !isCurrentBvidMatch) {
							return t
						}

						updated = true
						return {
							...bt,
							...(trackOverrides || {}),
							bilibiliMetadata: {
								...bt.bilibiliMetadata,
								...(extraMetadata || {}),
								bilibiliStreamUrl: streamUrlData,
							},
						}
					})

					if (!updated) return state

					const nextCurrentTrack =
						state.currentIndex >= 0 && state.currentIndex < newQueue.length
							? cloneTrack(newQueue[state.currentIndex])
							: state.currentTrack

					return {
						queue: newQueue,
						currentTrack: nextCurrentTrack,
					}
				})
			},

			next: () => {
				const { queue, currentIndex, playMode } = get()
				let { shuffledIndices } = get()
				if (queue.length === 0) return null

				if (playMode === 'repeat_one') {
					const validIdx = currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0
					const active = cloneTrack(queue[validIdx])
					set({ currentIndex: validIdx, currentTrack: active })
					return active
				}

				if (playMode === 'shuffle') {
					if (shuffledIndices.length !== queue.length) {
						shuffledIndices = generateShuffleIndices(queue.length)
					}
					const currShufflePos = shuffledIndices.indexOf(currentIndex)
					const nextShufflePos = (currShufflePos + 1) % shuffledIndices.length
					const nextIdx = shuffledIndices[nextShufflePos] ?? 0
					const active = cloneTrack(queue[nextIdx])
					set({ currentIndex: nextIdx, currentTrack: active, shuffledIndices })
					return active
				}

				const nextIdx = currentIndex + 1
				if (nextIdx >= queue.length) {
					if (playMode === 'repeat_all') {
						const active = cloneTrack(queue[0])
						set({ currentIndex: 0, currentTrack: active })
						return active
					}
					return null
				}

				const active = cloneTrack(queue[nextIdx])
				set({ currentIndex: nextIdx, currentTrack: active })
				return active
			},

			prev: () => {
				const { queue, currentIndex, playMode } = get()
				let { shuffledIndices } = get()
				if (queue.length === 0) return null

				if (playMode === 'repeat_one') {
					const validIdx = currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0
					const active = cloneTrack(queue[validIdx])
					set({ currentIndex: validIdx, currentTrack: active })
					return active
				}

				if (playMode === 'shuffle') {
					if (shuffledIndices.length !== queue.length) {
						shuffledIndices = generateShuffleIndices(queue.length)
					}
					const currShufflePos = shuffledIndices.indexOf(currentIndex)
					const prevShufflePos =
						(currShufflePos - 1 + shuffledIndices.length) %
						shuffledIndices.length
					const prevIdx = shuffledIndices[prevShufflePos] ?? 0
					const active = cloneTrack(queue[prevIdx])
					set({ currentIndex: prevIdx, currentTrack: active, shuffledIndices })
					return active
				}

				const prevIdx = currentIndex - 1
				if (prevIdx < 0) {
					if (playMode === 'repeat_all') {
						const lastIdx = queue.length - 1
						const active = cloneTrack(queue[lastIdx])
						set({ currentIndex: lastIdx, currentTrack: active })
						return active
					}
					return null
				}

				const active = cloneTrack(queue[prevIdx])
				set({ currentIndex: prevIdx, currentTrack: active })
				return active
			},

			setPlayMode: (mode) => {
				const { queue } = get()
				const shuffled =
					mode === 'shuffle' ? generateShuffleIndices(queue.length) : []
				set({ playMode: mode, shuffledIndices: shuffled })
			},

			getCurrentTrack: () => {
				const state = get()
				if (state.currentTrack) return state.currentTrack
				if (state.currentIndex >= 0 && state.currentIndex < state.queue.length) {
					return state.queue[state.currentIndex] ?? null
				}
				return null
			},
		}),
		{
			name: 'bili_player_queue_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			partialize: (state) => ({
				queue: state.queue,
				currentIndex: state.currentIndex,
				currentTrack: state.currentTrack,
				playMode: state.playMode,
				shuffledIndices: state.shuffledIndices,
			}),
			onRehydrateStorage: () => (state) => {
				if (
					state &&
					state.currentIndex >= 0 &&
					state.currentIndex < state.queue.length
				) {
					state.currentTrack = cloneTrack(state.queue[state.currentIndex])
				}
			},
		},
	),
)

export const useCurrentTrack = (): Track | null =>
	useQueueStore(
		(state) =>
			state.currentTrack ??
			(state.currentIndex >= 0 && state.currentIndex < state.queue.length
				? state.queue[state.currentIndex] ?? null
				: null),
	)