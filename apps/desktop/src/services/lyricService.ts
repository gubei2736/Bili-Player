import {
	neteaseApi,
	qqMusicApi,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'
import { parseYrc, parseSpl, parseAndMergeLyrics, type SplLyricData } from '@bbplayer/splash'

export interface UnifiedLyricResult {
	trackKey: string
	splContent: string
	source: 'netease' | 'qqmusic' | 'kugou' | 'custom'
	title: string
	artist: string
	offsetMs: number
}

export interface LyricSearchCandidate {
	source: 'netease' | 'qqmusic' | 'kugou'
	id: string | number
	title: string
	artist: string
	duration: number
}

const LYRIC_STORAGE_PREFIX = 'bbplayer_spl_lyric_'
const LYRIC_OFFSET_PREFIX = 'bbplayer_lyric_offset_'

export function cleanTrackTitle(title: string): string {
	return title
		.replace(/【.*?】/g, '')
		.replace(/\[.*?\]/g, '')
		.replace(/（.*?）/g, '')
		.replace(/\(.*?\)/g, '')
		.replace(/《(.*?)》/g, '$1')
		.replace(/4K|1080P|60帧|无损音质|官方MV|完整版|高音质/gi, '')
		.replace(/[-_]/g, ' ')
		.trim()
}

export function getStoredLyricOffset(trackKey: string): number {
	try {
		const val = localStorage.getItem(LYRIC_OFFSET_PREFIX + trackKey)
		return val ? parseFloat(val) : 0
	} catch {
		return 0
	}
}

export function setStoredLyricOffset(trackKey: string, offsetMs: number): void {
	try {
		localStorage.setItem(LYRIC_OFFSET_PREFIX + trackKey, String(offsetMs))
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyric-offset-change', {
				detail: { trackKey, offsetMs },
			}),
		)
	} catch {}
}

export function getStoredCustomLyric(trackKey: string): string | null {
	try {
		return localStorage.getItem(LYRIC_STORAGE_PREFIX + trackKey)
	} catch {
		return null
	}
}

export function setStoredCustomLyric(trackKey: string, splContent: string): void {
	try {
		localStorage.setItem(LYRIC_STORAGE_PREFIX + trackKey, splContent)
		window.dispatchEvent(
			new CustomEvent('bbplayer:custom-lyric-change', {
				detail: { trackKey, splContent },
			}),
		)
	} catch {}
}

export class LyricService {
	// 1. Auto fetch & match lyrics from multi-sources
	async fetchLyricForTrack(track: Track): Promise<UnifiedLyricResult | null> {
		const trackKey = track.uniqueKey
		const customLyric = getStoredCustomLyric(trackKey)
		const offsetMs = getStoredLyricOffset(trackKey)

		if (customLyric) {
			return {
				trackKey,
				splContent: customLyric,
				source: 'custom',
				title: track.title,
				artist: track.artist?.name || '',
				offsetMs,
			}
		}

		const queryTitle = cleanTrackTitle(track.title) || track.title
		const queryArtist =
			track.artist?.name && track.artist.name !== '未知UP主' && track.artist.name !== '未知歌手'
				? track.artist.name
				: ''
		const searchKeyword = `${queryTitle} ${queryArtist}`.trim()

		// Try Netease First (Rich SPL/YRC Syllable lyrics)
		try {
			const neteaseSearchRes = await neteaseApi.search({
				keywords: searchKeyword,
				limit: 5,
			})
			if (neteaseSearchRes.isOk() && neteaseSearchRes.value.length > 0) {
				const bestMatch = neteaseSearchRes.value[0]!
				const lyricRes = await neteaseApi.getLyrics(bestMatch.remoteId as number)
				if (lyricRes.isOk()) {
					const data = lyricRes.value
					let splText = ''
					if (data.yrc?.lyric) {
						splText = parseYrc(data.yrc.lyric)
					} else if (data.lrc?.lyric) {
						splText = data.lrc.lyric
					}

					if (splText) {
						// Merge translation if exists
						if (data.tlyric?.lyric || data.romalrc?.lyric) {
							try {
								const mergedLines = parseAndMergeLyrics({
									lrc: splText,
									tlyric: data.tlyric?.lyric,
									romalrc: data.romalrc?.lyric,
								})
								// If parsed successfully, re-serialize or return
							} catch {}
						}

						return {
							trackKey,
							splContent: splText,
							source: 'netease',
							title: bestMatch.title,
							artist: bestMatch.artist,
							offsetMs,
						}
					}
				}
			}
		} catch (err) {
			console.warn('Netease lyric fetch skipped:', err)
		}

		// Fallback to QQ Music
		try {
			const qqSearchRes = await qqMusicApi.search(searchKeyword, 5)
			if (qqSearchRes.isOk() && qqSearchRes.value.length > 0) {
				const bestMatch = qqSearchRes.value[0]!
				const lyricRes = await qqMusicApi.getLyrics(bestMatch.remoteId as string)
				if (lyricRes.isOk()) {
					const text = lyricRes.value.lyric || ''
					if (text) {
						return {
							trackKey,
							splContent: text,
							source: 'qqmusic',
							title: bestMatch.title,
							artist: bestMatch.artist,
							offsetMs,
						}
					}
				}
			}
		} catch (err) {
			console.warn('QQ Music lyric fetch skipped:', err)
		}

		return null
	}

	// 2. Manual Candidate Search
	async searchCandidates(keyword: string): Promise<LyricSearchCandidate[]> {
		const candidates: LyricSearchCandidate[] = []
		if (!keyword.trim()) return candidates

		const [nRes, qRes] = await Promise.allSettled([
			neteaseApi.search({ keywords: keyword, limit: 5 }),
			qqMusicApi.search(keyword, 5),
		])

		if (nRes.status === 'fulfilled' && nRes.value.isOk()) {
			for (const item of nRes.value.value) {
				candidates.push({
					source: 'netease',
					id: item.remoteId,
					title: item.title,
					artist: item.artist,
					duration: item.duration,
				})
			}
		}

		if (qRes.status === 'fulfilled' && qRes.value.isOk()) {
			for (const item of qRes.value.value) {
				candidates.push({
					source: 'qqmusic',
					id: item.remoteId,
					title: item.title,
					artist: item.artist,
					duration: item.duration,
				})
			}
		}

		return candidates
	}

	// 3. Fetch candidate's lyrics
	async fetchCandidateLyrics(candidate: LyricSearchCandidate): Promise<string | null> {
		if (candidate.source === 'netease') {
			const res = await neteaseApi.getLyrics(Number(candidate.id))
			if (res.isOk()) {
				if (res.value.yrc?.lyric) {
					return parseYrc(res.value.yrc.lyric)
				}
				return res.value.lrc?.lyric || null
			}
		} else if (candidate.source === 'qqmusic') {
			const res = await qqMusicApi.getLyrics(String(candidate.id))
			if (res.isOk()) {
				return res.value.lyric || null
			}
		}
		return null
	}
}

export const lyricService = new LyricService()
