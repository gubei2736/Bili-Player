import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { bilibiliApi } from '../api/bilibili/api'
import type {
	BilibiliCollection,
	BilibiliPlaylist,
} from '../types/bilibili'
import { getDefaultStateStorage } from './storage'

export interface PlaylistState {
	selectedPlaylistId: number | null
	favoritePlaylists: BilibiliPlaylist[]
	collections: BilibiliCollection[]
	isLoading: boolean
	error: string | null

	setSelectedPlaylistId: (id: number | null) => void
	setFavoritePlaylists: (list: BilibiliPlaylist[]) => void
	setCollections: (list: BilibiliCollection[]) => void
	syncRemotePlaylists: (userMid: number) => Promise<void>
}

export const usePlaylistStore = create<PlaylistState>()(
	persist(
		(set) => ({
			selectedPlaylistId: null,
			favoritePlaylists: [],
			collections: [],
			isLoading: false,
			error: null,

			setSelectedPlaylistId: (id) => {
				set({ selectedPlaylistId: id })
			},

			setFavoritePlaylists: (list) => {
				set({ favoritePlaylists: list })
			},

			setCollections: (list) => {
				set({ collections: list })
			},

			syncRemotePlaylists: async (userMid: number) => {
				set({ isLoading: true, error: null })
				try {
					const [favResult, colResult] = await Promise.all([
						bilibiliApi.getFavoritePlaylists({ userMid }),
						bilibiliApi.getCollectionsList({ mid: userMid, pageNumber: 1 }),
					])

					set({
						favoritePlaylists: favResult.isOk() ? favResult.value : [],
						collections: colResult.isOk() ? colResult.value.list : [],
						isLoading: false,
					})
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
				favoritePlaylists: state.favoritePlaylists,
				collections: state.collections,
			}),
		},
	),
)
