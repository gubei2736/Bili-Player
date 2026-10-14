export interface GenericTrack {
	title: string
	artists: string[]
	album: string
	duration: number // milliseconds
	coverUrl?: string | undefined
	translatedTitle?: string | undefined
}

export interface GenericPlaylist {
	id: string
	title: string
	coverUrl: string
	description: string
	trackCount: number
	author: {
		name: string
		id?: string | number
	}
}

export type PlaylistType =
	| 'favorite'
	| 'collection'
	| 'series'
	| 'multi_page'
	| 'local'
	| 'dynamic'

export type PlaylistPreference = 'inherit' | 'music' | 'podcast'

export type PlaylistShareRole = 'owner' | 'editor' | 'subscriber'

export type PlaylistSyncOperation =
	| 'add_tracks'
	| 'remove_tracks'
	| 'reorder_track'
	| 'update_metadata'
