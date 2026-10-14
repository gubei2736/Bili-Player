import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Track } from '../types/media'
import { getDefaultStateStorage } from './storage'

export interface LocalPlaylist {
	id: string
	title: string
	intro?: string
	coverUrl?: string | null
	tracks: Track[]
	createdAt: number
	updatedAt: number
}

export interface LocalPlaylistState {
	playlists: LocalPlaylist[]
	selectedPlaylistId: string | null

	setSelectedPlaylistId: (id: string | null) => void
	createPlaylist: (title: string, intro?: string, coverUrl?: string | null, initialTracks?: Track[]) => LocalPlaylist
	deletePlaylist: (id: string) => void
	addTrackToPlaylist: (playlistId: string, track: Track) => boolean
	removeTrackFromPlaylist: (playlistId: string, trackUniqueKey: string) => void
	getPlaylistById: (id: string) => LocalPlaylist | undefined
}

export const useLocalPlaylistStore = create<LocalPlaylistState>()(
	persist(
		(set, get) => ({
			playlists: [],
			selectedPlaylistId: null,

			setSelectedPlaylistId: (id) => {
				set({ selectedPlaylistId: id })
			},

			createPlaylist: (title, intro = '', coverUrl = '', initialTracks = []) => {
				const newPlaylist: LocalPlaylist = {
					id: `local_pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					title: title.trim() || '新建歌单',
					intro: intro.trim(),
					coverUrl: coverUrl || initialTracks[0]?.coverUrl || '',
					tracks: initialTracks,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}

				set((state) => ({
					playlists: [newPlaylist, ...state.playlists],
				}))

				return newPlaylist
			},

			deletePlaylist: (id) => {
				set((state) => ({
					playlists: state.playlists.filter((p) => p.id !== id),
					selectedPlaylistId: state.selectedPlaylistId === id ? null : state.selectedPlaylistId,
				}))
			},

			addTrackToPlaylist: (playlistId, track) => {
				const state = get()
				const target = state.playlists.find((p) => p.id === playlistId)
				if (!target) return false

				// Check duplicate
				const exists = target.tracks.some((t) => t.uniqueKey === track.uniqueKey)
				if (exists) return false

				set((currState) => ({
					playlists: currState.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						return {
							...pl,
							tracks: [...pl.tracks, track],
							coverUrl: pl.coverUrl || track.coverUrl,
							updatedAt: Date.now(),
						}
					}),
				}))

				return true
			},

			removeTrackFromPlaylist: (playlistId, trackUniqueKey) => {
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						return {
							...pl,
							tracks: pl.tracks.filter((t) => t.uniqueKey !== trackUniqueKey),
							updatedAt: Date.now(),
						}
					}),
				}))
			},

			getPlaylistById: (id) => {
				return get().playlists.find((p) => p.id === id)
			},
		}),
		{
			name: 'bbplayer_custom_library_playlists',
			storage: createJSONStorage(() => getDefaultStateStorage()),
		},
	),
)
