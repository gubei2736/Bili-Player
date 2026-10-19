import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { bilibiliApi } from '../api/bilibili/api'
import type {
	BilibiliCollection,
	BilibiliPlaylist,
} from '../types/bilibili'
import type { BilibiliTrack } from '../types/media'
import { getDefaultStateStorage } from './storage'

export interface PlaylistState {
	selectedPlaylistId: number | null
	selectedCollectionId: number | null
	favoritePlaylists: BilibiliPlaylist[]
	collections: BilibiliCollection[]
	playlistTracksCache: Record<number, BilibiliTrack[]>
	collectionTracksCache: Record<number, BilibiliTrack[]>
	isLoading: boolean
	error: string | null

	setSelectedPlaylistId: (id: number | null) => void
	setSelectedCollectionId: (id: number | null) => void
	setFavoritePlaylists: (list: BilibiliPlaylist[]) => void
	setCollections: (list: BilibiliCollection[]) => void
	setPlaylistTracksCache: (favoriteId: number, tracks: BilibiliTrack[]) => void
	clearPlaylistTracksCache: (favoriteId?: number) => void
	setCollectionTracksCache: (collectionId: number, tracks: BilibiliTrack[]) => void
	clearCollectionTracksCache: (collectionId?: number) => void
	syncRemotePlaylists: (userMid: number) => Promise<void>
}

export const usePlaylistStore = create<PlaylistState>()(
	persist(
		(set, get) => ({
			selectedPlaylistId: null,
			selectedCollectionId: null,
			favoritePlaylists: [],
			collections: [],
			playlistTracksCache: {},
			collectionTracksCache: {},
			isLoading: false,
			error: null,

			setSelectedPlaylistId: (id) => {
				set({ selectedPlaylistId: id })
			},

			setSelectedCollectionId: (id) => {
				set({ selectedCollectionId: id })
			},

			setFavoritePlaylists: (list) => {
				set({ favoritePlaylists: list })
			},

			setCollections: (list) => {
				set({ collections: list })
			},

			setPlaylistTracksCache: (favoriteId, tracks) => {
				set((state) => ({
					playlistTracksCache: {
						...state.playlistTracksCache,
						[favoriteId]: tracks,
					},
				}))
			},

			clearPlaylistTracksCache: (favoriteId) => {
				set((state) => {
					if (favoriteId !== undefined) {
						const next = { ...state.playlistTracksCache }
						delete next[favoriteId]
						return { playlistTracksCache: next }
					}
					return { playlistTracksCache: {} }
				})
			},

			setCollectionTracksCache: (collectionId, tracks) => {
				set((state) => ({
					collectionTracksCache: {
						...state.collectionTracksCache,
						[collectionId]: tracks,
					},
				}))
			},

			clearCollectionTracksCache: (collectionId) => {
				set((state) => {
					if (collectionId !== undefined) {
						const next = { ...state.collectionTracksCache }
						delete next[collectionId]
						return { collectionTracksCache: next }
					}
					return { collectionTracksCache: {} }
				})
			},

			syncRemotePlaylists: async (userMid: number) => {
				set({ isLoading: true, error: null })
				try {
					const [favResult, colResult] = await Promise.all([
						bilibiliApi.getFavoritePlaylists({ userMid }),
						bilibiliApi.getCollectionsList({ mid: userMid, pageNumber: 1 }),
					])

					const favList = favResult.isOk() ? favResult.value : []
					const colList = colResult.isOk() ? colResult.value.list : []

					set((state) => ({
						favoritePlaylists: favList,
						collections: colList,
						selectedPlaylistId:
							state.selectedPlaylistId && favList.some((p) => p.id === state.selectedPlaylistId)
								? state.selectedPlaylistId
								: favList[0]?.id || null,
						isLoading: false,
					}))
				} catch (e) {
					set({
						isLoading: false,
						error: e instanceof Error ? e.message : String(e),
					})
				}
			},
		}),
		{
			name: 'bbplayer_playlist_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			partialize: (state) => ({
				selectedPlaylistId: state.selectedPlaylistId,
				selectedCollectionId: state.selectedCollectionId,
				favoritePlaylists: state.favoritePlaylists,
				collections: state.collections,
				playlistTracksCache: state.playlistTracksCache,
				collectionTracksCache: state.collectionTracksCache,
			}),
		},
	),
)
