import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Track, BilibiliTrack } from '../types/media'
import { getDefaultStateStorage } from './storage'

export type PlayMode = 'sequential' | 'shuffle' | 'repeat_one' | 'repeat_all'

export interface QueueState {
	queue: Track[]
	currentIndex: number
	playMode: PlayMode
	shuffledIndices: number[]

	setQueue: (tracks: Track[], startIndex?: number) => void
	addTrack: (track: Track, playNext?: boolean) => void
	removeTrack: (index: number) => void
	clearQueue: () => void
	setCurrentIndex: (index: number) => void
	updateTrackStream: (
		uniqueKey: string,
		streamUrlData: NonNullable<BilibiliTrack['bilibiliMetadata']['bilibiliStreamUrl']>,
		extraMetadata?: Partial<BilibiliTrack['bilibiliMetadata']>,
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

export const useQueueStore = create<QueueState>()(
	persist(
		(set, get) => ({
			queue: [],
			currentIndex: -1,
			playMode: 'sequential',
			shuffledIndices: [],

			setQueue: (tracks, startIndex = 0) => {
				const validIndex =
					tracks.length > 0
						? Math.max(0, Math.min(startIndex, tracks.length - 1))
						: -1

				const shuffled =
					get().playMode === 'shuffle'
						? generateShuffleIndices(tracks.length)
						: []

				set({
					queue: tracks,
					currentIndex: validIndex,
					shuffledIndices: shuffled,
				})
			},

			addTrack: (track, playNext = false) => {
				const { queue, currentIndex } = get()
				const existingIndex = queue.findIndex(
					(t) => t.uniqueKey === track.uniqueKey,
				)

				if (existingIndex !== -1) {
					// Already in queue
					if (playNext && existingIndex !== currentIndex) {
						const newQueue = [...queue]
						const [removed] = newQueue.splice(existingIndex, 1)
						if (removed) {
							const insertPos =
								currentIndex >= 0 ? currentIndex + 1 : newQueue.length
							newQueue.splice(insertPos, 0, removed)
							set({ queue: newQueue })
						}
					}
					return
				}

				const newQueue = [...queue]
				if (playNext && currentIndex >= 0) {
					newQueue.splice(currentIndex + 1, 0, track)
				} else {
					newQueue.push(track)
				}

				set({
					queue: newQueue,
					currentIndex: currentIndex === -1 ? 0 : currentIndex,
					shuffledIndices:
						get().playMode === 'shuffle'
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
					shuffledIndices: [],
				})
			},

			setCurrentIndex: (index) => {
				const { queue } = get()
				if (index >= 0 && index < queue.length) {
					set({ currentIndex: index })
				}
			},

			updateTrackStream: (uniqueKey, streamUrlData, extraMetadata) => {
				const { queue } = get()
				const newQueue = queue.map((t) => {
					if (t.uniqueKey === uniqueKey && t.source === 'bilibili') {
						const bt = t as BilibiliTrack
						return {
							...bt,
							bilibiliMetadata: {
								...bt.bilibiliMetadata,
								...(extraMetadata || {}),
								bilibiliStreamUrl: streamUrlData,
							},
						}
					}
					return t
				})
				set({ queue: newQueue })
			},

			next: () => {
				const { queue, currentIndex, playMode } = get()
				let { shuffledIndices } = get()
				if (queue.length === 0) return null

				if (playMode === 'repeat_one') {
					const validIdx = currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0
					return queue[validIdx] ?? null
				}

				if (playMode === 'shuffle') {
					if (shuffledIndices.length !== queue.length) {
						shuffledIndices = generateShuffleIndices(queue.length)
					}
					const currShufflePos = shuffledIndices.indexOf(currentIndex)
					const nextShufflePos = (currShufflePos + 1) % shuffledIndices.length
					const nextIdx = shuffledIndices[nextShufflePos] ?? 0
					set({ currentIndex: nextIdx, shuffledIndices })
					return queue[nextIdx] ?? null
				}

				const nextIdx = currentIndex + 1
				if (nextIdx >= queue.length) {
					if (playMode === 'repeat_all') {
						set({ currentIndex: 0 })
						return queue[0] ?? null
					}
					return null
				}

				set({ currentIndex: nextIdx })
				return queue[nextIdx] ?? null
			},

			prev: () => {
				const { queue, currentIndex, playMode } = get()
				let { shuffledIndices } = get()
				if (queue.length === 0) return null

				if (playMode === 'repeat_one') {
					const validIdx = currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0
					return queue[validIdx] ?? null
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
					set({ currentIndex: prevIdx, shuffledIndices })
					return queue[prevIdx] ?? null
				}

				const prevIdx = currentIndex - 1
				if (prevIdx < 0) {
					if (playMode === 'repeat_all') {
						const lastIdx = queue.length - 1
						set({ currentIndex: lastIdx })
						return queue[lastIdx] ?? null
					}
					return null
				}

				set({ currentIndex: prevIdx })
				return queue[prevIdx] ?? null
			},

			setPlayMode: (mode) => {
				const { queue } = get()
				const shuffled =
					mode === 'shuffle' ? generateShuffleIndices(queue.length) : []
				set({ playMode: mode, shuffledIndices: shuffled })
			},

			getCurrentTrack: () => {
				const { queue, currentIndex } = get()
				if (currentIndex >= 0 && currentIndex < queue.length) {
					return queue[currentIndex] ?? null
				}
				return null
			},
		}),
		{
			name: 'bbplayer_queue_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			partialize: (state) => ({
				queue: state.queue,
				currentIndex: state.currentIndex,
				playMode: state.playMode,
				shuffledIndices: state.shuffledIndices,
			}),
		},
	),
)