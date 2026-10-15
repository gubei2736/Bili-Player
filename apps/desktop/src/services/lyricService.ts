import {
	neteaseApi,
	qqMusicApi,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'
import {
	parseYrc,
	parseSpl,
	parseAndMergeLyrics,
	parseTimeTag,
	type SplLyricData,
} from '@bbplayer/splash'

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
const LYRIC_OPT_TRANS_KEY = 'bbplayer_lyric_opt_translation'
const LYRIC_OPT_ROMA_KEY = 'bbplayer_lyric_opt_romaji'

export function getLyricOptionTranslation(): boolean {
	try {
		const val = localStorage.getItem(LYRIC_OPT_TRANS_KEY)
		return val !== null ? val === 'true' : true
	} catch {
		return true
	}
}

export function setLyricOptionTranslation(enabled: boolean): void {
	try {
		localStorage.setItem(LYRIC_OPT_TRANS_KEY, String(enabled))
	} catch {}
}

export function getLyricOptionRomaji(): boolean {
	try {
		const val = localStorage.getItem(LYRIC_OPT_ROMA_KEY)
		return val !== null ? val === 'true' : false
	} catch {
		return false
	}
}

export function setLyricOptionRomaji(enabled: boolean): void {
	try {
		localStorage.setItem(LYRIC_OPT_ROMA_KEY, String(enabled))
	} catch {}
}

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

function parseSecondaryLrcMap(lrcStr?: string): Map<number, string> {
	const map = new Map<number, string>()
	if (!lrcStr) return map
	const lines = lrcStr.split(/\r?\n/)
	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed) continue
		if (/^\[[a-zA-Z]+:.*\]$/.test(trimmed)) continue

		const match = /^(\[(-?\d{1,3}):(-?\d{1,2})\.(\d{1,6})\])+(.*)$/.exec(trimmed)
		if (match) {
			const content = match[match.length - 1].trim()
			if (!content) continue
			const timeRegex = /\[(-?\d{1,3}):(-?\d{1,2})\.(\d{1,6})\]/g
			let tMatch
			while ((tMatch = timeRegex.exec(match[0])) !== null) {
				const ms = parseTimeTag(tMatch[0])
				map.set(ms, content)
			}
		}
	}
	return map
}

function findClosestInMap(
	timeMs: number,
	map: Map<number, string>,
	toleranceMs = 400,
): string | undefined {
	if (map.has(timeMs)) return map.get(timeMs)
	let bestDiff = Infinity
	let bestVal: string | undefined = undefined
	for (const [t, val] of map.entries()) {
		const diff = Math.abs(t - timeMs)
		if (diff <= toleranceMs && diff < bestDiff) {
			bestDiff = diff
			bestVal = val
		}
	}
	return bestVal
}

export interface RawLyricEntry {
	lrc: string
	tlyric?: string
	romalrc?: string
	source: 'netease' | 'qqmusic' | 'custom'
	title: string
	artist: string
}

export function mergeLyricsToSpl(
	mainLrc: string,
	tlyric?: string,
	romalrc?: string,
	options?: { showTranslation?: boolean; showRomaji?: boolean },
): string {
	const showTrans = options?.showTranslation ?? getLyricOptionTranslation()
	const showRoma = options?.showRomaji ?? getLyricOptionRomaji()

	// 1. If mainLrc already contains [tr] or [ro] tags, extract them to support instantaneous toggle on cached/custom lyrics
	const embeddedTransMap = new Map<number, string>()
	const embeddedRomaMap = new Map<number, string>()
	const rawLines = mainLrc.split(/\r?\n/)
	const cleanedBaseLines: string[] = []
	let lastTimeMs: number | null = null
	const timeRegex = /\[(-?\d{1,3}):(-?\d{1,2})\.(\d{1,6})\]/

	for (const rawLine of rawLines) {
		const trimmed = rawLine.trim()
		if (!trimmed) {
			cleanedBaseLines.push(rawLine)
			continue
		}
		if (/^\[(ro|roma|romaji)\]/i.test(trimmed)) {
			if (lastTimeMs !== null) {
				embeddedRomaMap.set(
					lastTimeMs,
					trimmed.replace(/^\[(ro|roma|romaji)\]\s*/i, ''),
				)
			}
			continue
		}
		if (/^\[(tr|trans)\]/i.test(trimmed)) {
			if (lastTimeMs !== null) {
				embeddedTransMap.set(
					lastTimeMs,
					trimmed.replace(/^\[(tr|trans)\]\s*/i, ''),
				)
			}
			continue
		}

		cleanedBaseLines.push(rawLine)
		const match = timeRegex.exec(trimmed)
		if (match) {
			lastTimeMs = parseTimeTag(match[0])
		}
	}

	const transMap = tlyric
		? parseSecondaryLrcMap(tlyric)
		: embeddedTransMap.size > 0
			? embeddedTransMap
			: null
	const romaMap = romalrc
		? parseSecondaryLrcMap(romalrc)
		: embeddedRomaMap.size > 0
			? embeddedRomaMap
			: null

	// If neither translation nor romaji should be shown, return stripped base lyrics
	if (
		(!showTrans || !transMap || transMap.size === 0) &&
		(!showRoma || !romaMap || romaMap.size === 0)
	) {
		return cleanedBaseLines.join('\n')
	}

	const resultLines: string[] = []

	for (let i = 0; i < cleanedBaseLines.length; i++) {
		const line = cleanedBaseLines[i]
		const trimmed = line.trim()
		resultLines.push(line)
		if (!trimmed) continue

		if (/^\[[a-zA-Z]+:.*\]$/.test(trimmed)) continue

		const match = timeRegex.exec(trimmed)
		if (match) {
			const timeMs = parseTimeTag(match[0])
			if (showRoma && romaMap) {
				const romaText = findClosestInMap(timeMs, romaMap)
				if (romaText) {
					resultLines.push(`[ro]${romaText}`)
				}
			}
			if (showTrans && transMap) {
				const transText = findClosestInMap(timeMs, transMap)
				if (transText) {
					resultLines.push(`[tr]${transText}`)
				}
			}
		}
	}

	return resultLines.join('\n')
}

export class LyricService {
	private rawCache = new Map<string, RawLyricEntry>()

	// Reapply display options in memory without network request
	reapplyOptions(
		trackKey: string,
		options: { showTranslation?: boolean; showRomaji?: boolean },
	): string | null {
		const entry = this.rawCache.get(trackKey)
		if (entry) {
			return mergeLyricsToSpl(entry.lrc, entry.tlyric, entry.romalrc, options)
		}
		const custom = getStoredCustomLyric(trackKey)
		if (custom) {
			return mergeLyricsToSpl(custom, undefined, undefined, options)
		}
		return null
	}

	// 1. Auto fetch & match lyrics from multi-sources
	async fetchLyricForTrack(
		track: Track,
		forceFresh = false,
		options?: { showTranslation?: boolean; showRomaji?: boolean },
	): Promise<UnifiedLyricResult | null> {
		const trackKey = track.uniqueKey
		const customLyric = getStoredCustomLyric(trackKey)
		const offsetMs = getStoredLyricOffset(trackKey)

		if (!forceFresh && customLyric) {
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

		// Try Netease First (Rich SPL/YRC Syllable lyrics with translation & romaji)
		try {
			const neteaseSearchRes = await neteaseApi.search({
				keywords: searchKeyword,
				limit: 5,
			})
			if (neteaseSearchRes.isOk() && neteaseSearchRes.value.length > 0) {
				const bestMatch = neteaseSearchRes.value[0]!
				const lyricRes = await neteaseApi.getLyrics(bestMatch.remoteId as number)
				if (lyricRes.isOk()) {
					const parsedData = neteaseApi.parseLyrics(lyricRes.value)
					if (parsedData.lrc) {
						this.rawCache.set(trackKey, {
							lrc: parsedData.lrc,
							tlyric: parsedData.tlyric,
							romalrc: parsedData.romalrc,
							source: 'netease',
							title: bestMatch.title,
							artist: bestMatch.artist,
						})

						const splText = mergeLyricsToSpl(
							parsedData.lrc,
							parsedData.tlyric,
							parsedData.romalrc,
							options,
						)

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
					const parsedData = qqMusicApi.parseLyrics(lyricRes.value)
					if (parsedData.lrc) {
						this.rawCache.set(trackKey, {
							lrc: parsedData.lrc,
							tlyric: parsedData.tlyric,
							romalrc: undefined,
							source: 'qqmusic',
							title: bestMatch.title,
							artist: bestMatch.artist,
						})

						const splText = mergeLyricsToSpl(
							parsedData.lrc,
							parsedData.tlyric,
							undefined,
							options,
						)

						return {
							trackKey,
							splContent: splText,
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

	// 3. Fetch candidate's lyrics with translation and romaji options
	async fetchCandidateLyrics(
		candidate: LyricSearchCandidate,
		options?: { showTranslation?: boolean; showRomaji?: boolean },
		trackKey?: string,
	): Promise<string | null> {
		if (candidate.source === 'netease') {
			try {
				const res = await neteaseApi.getLyrics(Number(candidate.id))
				if (res.isOk()) {
					const parsedData = neteaseApi.parseLyrics(res.value)
					if (parsedData.lrc) {
						if (trackKey) {
							this.rawCache.set(trackKey, {
								lrc: parsedData.lrc,
								tlyric: parsedData.tlyric,
								romalrc: parsedData.romalrc,
								source: 'netease',
								title: candidate.title,
								artist: candidate.artist,
							})
						}
						return mergeLyricsToSpl(
							parsedData.lrc,
							parsedData.tlyric,
							parsedData.romalrc,
							options,
						)
					}
				}
			} catch (e) {
				console.error('Fetch netease lyrics error:', e)
			}
		} else if (candidate.source === 'qqmusic') {
			try {
				const res = await qqMusicApi.getLyrics(String(candidate.id))
				if (res.isOk()) {
					const parsedData = qqMusicApi.parseLyrics(res.value)
					if (parsedData.lrc) {
						if (trackKey) {
							this.rawCache.set(trackKey, {
								lrc: parsedData.lrc,
								tlyric: parsedData.tlyric,
								romalrc: undefined,
								source: 'qqmusic',
								title: candidate.title,
								artist: candidate.artist,
							})
						}
						return mergeLyricsToSpl(
							parsedData.lrc,
							parsedData.tlyric,
							undefined,
							options,
						)
					}
				}
			} catch (e) {
				console.error('Fetch qqmusic lyrics error:', e)
			}
		}
		return null
	}
}

export const lyricService = new LyricService()
