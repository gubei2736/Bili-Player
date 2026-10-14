export interface QQMusicSong {
	id: number
	mid: string
	name: string
	title: string
	subtitle: string
	singer: {
		id: number
		mid: string
		name: string
		title: string
		type: number
		uin: number
	}[]
	album: {
		id: number
		mid: string
		name: string
		title: string
		subtitle: string
		time_public: string
		pmid: string
	}
	mv?: {
		id: number
		vid: string
		name: string
		title: string
		vt: number
	}
	interval: number // Duration in seconds
}

export interface QQMusicSearchResponse {
	code: number
	req: {
		code: number
		data: {
			body: {
				song: {
					list: QQMusicSong[]
				}
			}
		}
	}
}

export interface QQMusicLyricResponse {
	retcode: number
	code: number
	subcode: number
	lyric: string
	trans: string
}

export interface QQMusicPlaylist {
	disstid: string
	dissname: string
	desc: string
	songnum: number
	logo: string
	nickname: string
	songlist: QQMusicSong[]
}

export interface QQMusicPlaylistResponse {
	code: number
	data?: {
		cdlist?: QQMusicPlaylist[]
	}
}
