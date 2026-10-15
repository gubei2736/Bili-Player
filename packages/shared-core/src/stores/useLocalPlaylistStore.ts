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

export const DEFAULT_FAVORITES_PLAYLIST_ID = 'local_pl_favorites'

export const createDefaultFavoritesPlaylist = (): LocalPlaylist => ({
	id: DEFAULT_FAVORITES_PLAYLIST_ID,
	title: '我喜欢的音乐',
	intro: '',
	coverUrl: '',
	tracks: [],
	createdAt: 0,
	updatedAt: Date.now(),
})

export interface LocalPlaylistState {
	playlists: LocalPlaylist[]
	selectedPlaylistId: string | null

	setSelectedPlaylistId: (id: string | null) => void
	createPlaylist: (
		title: string,
		intro?: string,
		coverUrl?: string | null,
		initialTracks?: Track[],
	) => LocalPlaylist
	deletePlaylist: (id: string) => void
	addTrackToPlaylist: (playlistId: string, track: Track) => boolean
	removeTrackFromPlaylist: (playlistId: string, trackUniqueKey: string) => void
	getPlaylistById: (id: string) => LocalPlaylist | undefined
	toggleFavoriteTrack: (track: Track) => boolean
	isFavoriteTrack: (trackUniqueKey: string) => boolean
}

export const useLocalPlaylistStore = create<LocalPlaylistState>()(
	persist(
		(set, get) => ({
			playlists: [createDefaultFavoritesPlaylist()],
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
					playlists: [
						...state.playlists.filter((p) => p.id === DEFAULT_FAVORITES_PLAYLIST_ID),
						newPlaylist,
						...state.playlists.filter((p) => p.id !== DEFAULT_FAVORITES_PLAYLIST_ID),
					],
				}))

				return newPlaylist
			},

			deletePlaylist: (id) => {
				if (id === DEFAULT_FAVORITES_PLAYLIST_ID) {
					// 默认“我喜欢的音乐”歌单禁止被删除
					return
				}
				set((state) => ({
					playlists: state.playlists.filter((p) => p.id !== id),
					selectedPlaylistId:
						state.selectedPlaylistId === id ? null : state.selectedPlaylistId,
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
							tracks: [track, ...pl.tracks],
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

			toggleFavoriteTrack: (track) => {
				const state = get()
				const favPl = state.playlists.find((p) => p.id === DEFAULT_FAVORITES_PLAYLIST_ID)
				const exists = favPl ? favPl.tracks.some((t) => t.uniqueKey === track.uniqueKey) : false

				if (exists) {
					// 从我喜欢的音乐歌单移除
					set((curr) => ({
						playlists: curr.playlists.map((pl) => {
							if (pl.id !== DEFAULT_FAVORITES_PLAYLIST_ID) return pl
							return {
								...pl,
								tracks: pl.tracks.filter((t) => t.uniqueKey !== track.uniqueKey),
								updatedAt: Date.now(),
							}
						}),
					}))
					return false
				} else {
					// 添加至我喜欢的音乐歌单头部
					set((curr) => {
						const hasFav = curr.playlists.some((p) => p.id === DEFAULT_FAVORITES_PLAYLIST_ID)
						if (hasFav) {
							return {
								playlists: curr.playlists.map((pl) => {
									if (pl.id !== DEFAULT_FAVORITES_PLAYLIST_ID) return pl
									return {
										...pl,
										tracks: [track, ...pl.tracks],
										coverUrl: track.coverUrl || pl.coverUrl,
										updatedAt: Date.now(),
									}
								}),
							}
						} else {
							const newFav = createDefaultFavoritesPlaylist()
							newFav.tracks = [track]
							newFav.coverUrl = track.coverUrl
							return {
								playlists: [newFav, ...curr.playlists],
							}
						}
					})
					return true
				}
			},

			isFavoriteTrack: (trackUniqueKey) => {
				if (!trackUniqueKey) return false
				const favPl = get().playlists.find((p) => p.id === DEFAULT_FAVORITES_PLAYLIST_ID)
				if (!favPl) return false
				return favPl.tracks.some((t) => t.uniqueKey === trackUniqueKey)
			},
		}),
		{
			name: 'bbplayer_custom_library_playlists',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			merge: (persistedState: any, currentState) => {
				const savedPlaylists = Array.isArray(persistedState?.playlists)
					? (persistedState.playlists as LocalPlaylist[])
					: []
				const hasDefault = savedPlaylists.some(
					(p) => p.id === DEFAULT_FAVORITES_PLAYLIST_ID,
				)
				const finalPlaylists = (
					hasDefault ? savedPlaylists : [createDefaultFavoritesPlaylist(), ...savedPlaylists]
				).map((p) => {
					if (
						p.id === DEFAULT_FAVORITES_PLAYLIST_ID &&
						(p.intro === '默认红心歌单，播放栏点击添加至我喜欢的音乐即可快速保存至此' || !p.intro)
					) {
						return { ...p, intro: '' }
					}
					return p
				})

				return {
					...currentState,
					...persistedState,
					playlists: finalPlaylists,
				}
			},
		},
	),
)
