export interface Artist {
	id: number
	name: string
	avatarUrl?: string | null
	signature?: string | null
	source: 'bilibili' | 'local'
	remoteId?: string | null
	createdAt: Date
	updatedAt: Date
}

export interface PlayRecord {
	startTime: number // 播放开始的时间戳 (ms)
	durationPlayed: number // 实际播放的秒数
	completed: boolean // 是否完整播放
}

export interface BaseTrack {
	id: number
	uniqueKey: string
	title: string
	artist: Artist | null
	coverUrl: string | null
	source: 'bilibili' | 'local'
	createdAt: Date
	duration: number // 歌曲时长，单位：秒
	updatedAt: Date
}

export interface BilibiliVideoPart {
	cid: number
	page: number
	part: string
	duration: number
}

export interface BilibiliTrack extends BaseTrack {
	source: 'bilibili'
	titleHtml?: string // 带有高亮标签的标题
	bilibiliMetadata: {
		bvid: string
		cid: number | null
		isMultiPage: boolean
		videoIsValid: boolean
		mainTrackTitle?: string | null // 如果是分 p 视频，保存该分 p 所在的主视频标题
		pageIndex?: number // 当前是第几 P (从 1 开始)
		pagePart?: string // 当前分 P 的副标题 (e.g. "01. 晴天")
		pages?: BilibiliVideoPart[] // 所有分 P 列表
		// 运行时产生的数据，在获取流后才会存在
		bilibiliStreamUrl?: {
			url: string
			quality: number
			bandwidth?: number
			codecs?: string
			getTime: number
			type: 'mp4' | 'dash' | 'local'
			rawDashInfo?: any
			volume?: {
				measured_i: number
				target_i: number
				multi_scene_args?: {
					high_dynamic_target_i: string
					normal_target_i: string
					undersized_target_i: string
				}
			}
		}
	}
}

export interface LocalTrack extends BaseTrack {
	source: 'local'
	localMetadata: {
		localPath: string
	}
}

export type Track = BilibiliTrack | LocalTrack
