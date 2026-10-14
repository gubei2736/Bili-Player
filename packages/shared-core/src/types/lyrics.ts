export type Tags = Record<string, string>

export interface OldLyricLine {
	timestamp: number // 单位：秒
	text: string
	translation?: string
}

export interface ParsedLrc {
	tags: Tags
	lyrics: OldLyricLine[] | null
	rawOriginalLyrics: string
	rawTranslatedLyrics?: string
	offset?: number // 单位：秒
}

export type LyricSearchResult = (
	| {
			source: 'netease'
			duration: number // 秒
			title: string
			artist: string
			remoteId: number
	  }
	| {
			source: 'qqmusic'
			duration: number // 秒
			title: string
			artist: string
			remoteId: string
	  }
	| {
			source: 'kugou'
			duration: number // 秒
			title: string
			artist: string
			remoteId: string
	  }
)[]

export interface LyricFileData {
	id: string // 歌曲唯一ID
	updateTime: number // 缓存时间
	lrc?: string | undefined // 主歌词
	tlyric?: string | undefined // 翻译歌词
	romalrc?: string | undefined // 罗马音歌词
	errorMessage?: string | undefined
	manualSkip?: boolean | undefined
	misc?: {
		userOffset?: number | undefined
	}
}

export type LyricProviderResponseData = Omit<
	LyricFileData,
	'id' | 'updateTime' | 'misc'
>
