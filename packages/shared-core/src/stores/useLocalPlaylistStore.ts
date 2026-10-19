import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Track } from '../types/media'
import { getDefaultStateStorage } from './storage'

export interface PlaylistFolder {
	id: string
	name: string
	createdAt: number
}

export interface LocalPlaylist {
	id: string
	title: string
	intro?: string
	coverUrl?: string | null
	tracks: Track[]
	folders?: PlaylistFolder[]
	trackFolderMap?: Record<string, string> // trackUniqueKey -> folderId
	createdAt: number
	updatedAt: number
}

export const DEFAULT_FAVORITES_PLAYLIST_ID = 'local_pl_favorites'
export const DEFAULT_LOCAL_MUSIC_PLAYLIST_ID = 'local_pl_local_music'

export const createDefaultFavoritesPlaylist = (): LocalPlaylist => ({
	id: DEFAULT_FAVORITES_PLAYLIST_ID,
	title: '我喜欢的音乐',
	intro: '',
	coverUrl: '',
	tracks: [],
	folders: [],
	trackFolderMap: {},
	createdAt: 0,
	updatedAt: Date.now(),
})

export const createDefaultLocalMusicPlaylist = (): LocalPlaylist => ({
	id: DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
	title: '本地歌曲',
	intro: '本地扫描音频',
	coverUrl: '',
	tracks: [],
	folders: [],
	trackFolderMap: {},
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
	addLocalTracks: (playlistId: string, newTracks: Track[]) => number
	removeTrackFromPlaylist: (playlistId: string, trackUniqueKey: string) => void
	updatePlaylist: (
		id: string,
		updates: { title?: string; intro?: string; coverUrl?: string | null },
	) => void
	reorderTracks: (playlistId: string, fromIndex: number, toIndex: number) => void
	updateTrackInPlaylist: (
		playlistId: string,
		trackUniqueKey: string,
		updatedTrack: Track,
	) => void
	createFolder: (playlistId: string, folderName: string) => PlaylistFolder | null
	renameFolder: (playlistId: string, folderId: string, newName: string) => void
	deleteFolder: (playlistId: string, folderId: string) => void
	setTrackFolder: (
		playlistId: string,
		trackUniqueKey: string,
		folderId: string | null,
	) => void
	getPlaylistById: (id: string) => LocalPlaylist | undefined
	toggleFavoriteTrack: (track: Track) => boolean
	isFavoriteTrack: (trackUniqueKey: string) => boolean
}

export const useLocalPlaylistStore = create<LocalPlaylistState>()(
	persist(
		(set, get) => ({
			playlists: [createDefaultFavoritesPlaylist(), createDefaultLocalMusicPlaylist()],
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
					folders: [],
					trackFolderMap: {},
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}

				set((state) => ({
					playlists: [
						...state.playlists.filter(
							(p) =>
								p.id === DEFAULT_FAVORITES_PLAYLIST_ID ||
								p.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
						),
						newPlaylist,
						...state.playlists.filter(
							(p) =>
								p.id !== DEFAULT_FAVORITES_PLAYLIST_ID &&
								p.id !== DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
						),
					],
				}))

				return newPlaylist
			},

			deletePlaylist: (id) => {
				if (
					id === DEFAULT_FAVORITES_PLAYLIST_ID ||
					id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID
				) {
					// 默认“我喜欢的音乐”和“本地歌曲”歌单禁止被删除
					return
				}
				set((state) => ({
					playlists: state.playlists.filter((p) => p.id !== id),
					selectedPlaylistId:
						state.selectedPlaylistId === id ? null : state.selectedPlaylistId,
				}))
			},

			addLocalTracks: (playlistId, newTracks) => {
				let addedCount = 0
				set((currState) => ({
					playlists: currState.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						const existingKeys = new Set(pl.tracks.map((t) => t.uniqueKey))
						const toAdd = newTracks.filter((t) => !existingKeys.has(t.uniqueKey))
						addedCount = toAdd.length
						if (toAdd.length === 0) return pl
						return {
							...pl,
							tracks: [...toAdd, ...pl.tracks],
							coverUrl: pl.coverUrl || toAdd[0]?.coverUrl || '',
							updatedAt: Date.now(),
						}
					}),
				}))
				return addedCount
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

			updatePlaylist: (id, updates) => {
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== id) return pl
						return {
							...pl,
							...(updates.title !== undefined ? { title: updates.title.trim() || pl.title } : {}),
							...(updates.intro !== undefined ? { intro: updates.intro.trim() } : {}),
							...(updates.coverUrl !== undefined ? { coverUrl: updates.coverUrl } : {}),
							updatedAt: Date.now(),
						}
					}),
				}))
			},

			reorderTracks: (playlistId, fromIndex, toIndex) => {
				if (fromIndex === toIndex) return
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						const newTracks = [...pl.tracks]
						if (
							fromIndex < 0 ||
							fromIndex >= newTracks.length ||
							toIndex < 0 ||
							toIndex >= newTracks.length
						) {
							return pl
						}
						const [movedItem] = newTracks.splice(fromIndex, 1)
						if (!movedItem) return pl
						newTracks.splice(toIndex, 0, movedItem)
						return {
							...pl,
							tracks: newTracks,
							updatedAt: Date.now(),
						}
					}),
				}))
			},

			updateTrackInPlaylist: (playlistId, trackUniqueKey, updatedTrack) => {
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						return {
							...pl,
							tracks: pl.tracks.map((t) => (t.uniqueKey === trackUniqueKey ? updatedTrack : t)),
							updatedAt: Date.now(),
						}
					}),
				}))
			},

			createFolder: (playlistId, folderName) => {
				const trimmed = folderName.trim()
				if (!trimmed) return null
				const newFolder: PlaylistFolder = {
					id: `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
					name: trimmed,
					createdAt: Date.now(),
				}
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						const folders = pl.folders || []
						return {
							...pl,
							folders: [...folders, newFolder],
							updatedAt: Date.now(),
						}
					}),
				}))
				return newFolder
			},

			renameFolder: (playlistId, folderId, newName) => {
				const trimmed = newName.trim()
				if (!trimmed) return
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						return {
							...pl,
							folders: (pl.folders || []).map((f) =>
								f.id === folderId ? { ...f, name: trimmed } : f,
							),
							updatedAt: Date.now(),
						}
					}),
				}))
			},

			deleteFolder: (playlistId, folderId) => {
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						const nextMap = { ...(pl.trackFolderMap || {}) }
						for (const key of Object.keys(nextMap)) {
							if (nextMap[key] === folderId) {
								delete nextMap[key]
							}
						}
						return {
							...pl,
							folders: (pl.folders || []).filter((f) => f.id !== folderId),
							trackFolderMap: nextMap,
							updatedAt: Date.now(),
						}
					}),
				}))
			},

			setTrackFolder: (playlistId, trackUniqueKey, folderId) => {
				set((state) => ({
					playlists: state.playlists.map((pl) => {
						if (pl.id !== playlistId) return pl
						const nextMap = { ...(pl.trackFolderMap || {}) }
						if (folderId) {
							nextMap[trackUniqueKey] = folderId
						} else {
							delete nextMap[trackUniqueKey]
						}
						return {
							...pl,
							trackFolderMap: nextMap,
							updatedAt: Date.now(),
						}
					}),
				}))
			},

			getPlaylistById: (id: string) => {
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
				const hasLocalMusic = savedPlaylists.some(
					(p) => p.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
				)
				let workingPlaylists = [...savedPlaylists]
				if (!hasDefault) {
					workingPlaylists = [createDefaultFavoritesPlaylist(), ...workingPlaylists]
				}
				if (!hasLocalMusic) {
					const favIdx = workingPlaylists.findIndex(
						(p) => p.id === DEFAULT_FAVORITES_PLAYLIST_ID,
					)
					workingPlaylists.splice(favIdx + 1, 0, createDefaultLocalMusicPlaylist())
				}
				const finalPlaylists = workingPlaylists.map((p) => {
					if (
						p.id === DEFAULT_FAVORITES_PLAYLIST_ID &&
						(p.intro === '默认红心歌单，播放栏点击添加至我喜欢的音乐即可快速保存至此' || !p.intro)
					) {
						return { ...p, intro: '' }
					}
					return {
						...p,
						folders: p.folders || [],
						trackFolderMap: p.trackFolderMap || {},
					}
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
