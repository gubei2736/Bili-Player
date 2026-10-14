export interface NeteasePlaylistResponse {
	code: number
	playlist?: NeteasePlaylist
}

export interface NeteasePlaylist {
	id: number
	name: string
	coverImgId: number
	coverImgUrl: string
	userId: number
	createTime: number
	description: string | null
	tags: string[]
	backgroundCoverId: number
	backgroundCoverUrl: string | null
	subscribedCount: number
	cloudTrackCount: number
	trackCount: number
	creator?: NeteaseCreator | null
	tracks?: NeteaseSong[] | null
}

export interface NeteaseCreator {
	userId: number
	nickname: string
	signature: string
	description: string
	avatarUrl: string
	backgroundUrl: string
}

export interface NeteaseSong {
	id: number
	name: string
	ar: NeteaseArtist[]
	alia: string[]
	al: NeteaseAlbum
	dt: number // Duration in ms
	tns?: string[]
}

export interface NeteaseArtist {
	id: number
	name: string
	tns: string[]
	alias: string[]
}

export interface NeteaseAlbum {
	id: number
	name: string
	picUrl: string
	tns: string[]
}

export interface NeteaseLyricResponse {
	lrc?: {
		version: number
		lyric: string
	}
	tlyric?: {
		version: number
		lyric: string
	}
	romalrc?: {
		version: number
		lyric: string
	}
	yrc?: {
		version: number
		lyric: string
	}
	ytlrc?: {
		version: number
		lyric: string
	}
	yromalrc?: {
		version: number
		lyric: string
	}
	code: number
}

export interface NeteaseSearchResponse {
	result?: {
		songs?: NeteaseSong[]
	}
	code: number
}
