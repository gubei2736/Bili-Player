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
const LYRIC_OPT_AUTO_MATCH_KEY = 'bbplayer_auto_match_lyrics'
const LYRIC_PREFERRED_SOURCE_KEY = 'bbplayer_preferred_lyric_source'

export type PreferredLyricSource = 'all' | 'qqmusic' | 'netease'

export function getPreferredLyricSource(): PreferredLyricSource {
	try {
		const val = localStorage.getItem(LYRIC_PREFERRED_SOURCE_KEY)
		if (val === 'qqmusic' || val === 'netease' || val === 'all') {
			return val
		}
		return 'qqmusic'
	} catch {
		return 'qqmusic'
	}
}

export function setPreferredLyricSource(source: PreferredLyricSource): void {
	try {
		localStorage.setItem(LYRIC_PREFERRED_SOURCE_KEY, source)
		window.dispatchEvent(
			new CustomEvent('bbplayer:preferred-lyric-source-change', {
				detail: { source },
			}),
		)
	} catch {}
}

export function getAutoMatchLyricsEnabled(): boolean {
	try {
		const val = localStorage.getItem(LYRIC_OPT_AUTO_MATCH_KEY)
		return val !== null ? val === 'true' : false
	} catch {
		return false
	}
}

export function setAutoMatchLyricsEnabled(enabled: boolean): void {
	try {
		localStorage.setItem(LYRIC_OPT_AUTO_MATCH_KEY, String(enabled))
		window.dispatchEvent(
			new CustomEvent('bbplayer:auto-match-lyrics-change', {
				detail: { enabled },
			}),
		)
	} catch {}
}

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
		.replace(
			/4K|1080P|720P|60帧|无损音质|超高音质|最高音质|官方MV|完整版|高音质|附MV|纯享版|现场版|合集|合辑|无损|全曲|自制MV|自制/gi,
			'',
		)
		.replace(/^(\d{1,3}[\s._-]+|P\d+[\s._-]+)/i, '')
		.replace(/[-_]/g, ' ')
		.replace(/\s+/g, ' ')
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

export function setStoredLyricOffset(trackKey: string, offsetSec: number): void {
	try {
		localStorage.setItem(LYRIC_OFFSET_PREFIX + trackKey, String(offsetSec))
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyric-offset-change', {
				detail: { trackKey, offsetSec, offsetMs: offsetSec },
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

// -------------------------------------------------------------
// 歌词各语言层级字号管理 (原文、翻译、罗马音)
// -------------------------------------------------------------
const LYRIC_FONT_SIZE_MAIN_KEY = 'bbplayer_lyric_font_size_main'
const LYRIC_FONT_SIZE_TRANS_KEY = 'bbplayer_lyric_font_size_trans'
const LYRIC_FONT_SIZE_ROMA_KEY = 'bbplayer_lyric_font_size_roma'

export interface LyricFontSizes {
	main: number // 原文歌词大小 (默认 24px)
	trans: number // 翻译歌词大小 (默认 15px)
	roma: number // 罗马音大小 (默认 13px)
}

export function getLyricFontSizes(): LyricFontSizes {
	try {
		const main = parseInt(localStorage.getItem(LYRIC_FONT_SIZE_MAIN_KEY) || '24', 10)
		const trans = parseInt(localStorage.getItem(LYRIC_FONT_SIZE_TRANS_KEY) || '15', 10)
		const roma = parseInt(localStorage.getItem(LYRIC_FONT_SIZE_ROMA_KEY) || '13', 10)
		return {
			main: isNaN(main) || main < 12 ? 24 : main,
			trans: isNaN(trans) || trans < 10 ? 15 : trans,
			roma: isNaN(roma) || roma < 9 ? 13 : roma,
		}
	} catch {
		return { main: 24, trans: 15, roma: 13 }
	}
}

export function setLyricFontSizes(sizes: Partial<LyricFontSizes>): void {
	try {
		if (sizes.main !== undefined) localStorage.setItem(LYRIC_FONT_SIZE_MAIN_KEY, String(sizes.main))
		if (sizes.trans !== undefined) localStorage.setItem(LYRIC_FONT_SIZE_TRANS_KEY, String(sizes.trans))
		if (sizes.roma !== undefined) localStorage.setItem(LYRIC_FONT_SIZE_ROMA_KEY, String(sizes.roma))
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyric-font-size-change', {
				detail: getLyricFontSizes(),
			}),
		)
	} catch {}
}

// -------------------------------------------------------------
// 歌词主字体高亮颜色管理 (自定义色值，同时作用于全屏歌词与桌面歌词)
// -------------------------------------------------------------
const LYRICS_HIGHLIGHT_COLOR_KEY = 'bbplayer_lyrics_highlight_color'
const DESKTOP_LYRICS_COLOR_KEY = 'bbplayer_desktop_lyrics_color'
export const DEFAULT_LYRICS_HIGHLIGHT_COLOR = '#00AEEC'
export const DEFAULT_DESKTOP_LYRICS_COLOR = DEFAULT_LYRICS_HIGHLIGHT_COLOR

export const PRESET_LYRICS_COLORS = [
	{ label: 'B站蓝', value: '#00AEEC' },
	{ label: '少女粉', value: '#FB7299' },
	{ label: '纯净白', value: '#FFFFFF' },
	{ label: '荧光金', value: '#FFD700' },
	{ label: '翡翠绿', value: '#10B981' },
	{ label: '极光紫', value: '#A855F7' },
	{ label: '落日橙', value: '#F97316' },
	{ label: '赛博青', value: '#06B6D4' },
]
export const PRESET_DESKTOP_LYRICS_COLORS = PRESET_LYRICS_COLORS

export function getLyricsHighlightColor(): string {
	try {
		return (
			localStorage.getItem(LYRICS_HIGHLIGHT_COLOR_KEY) ||
			localStorage.getItem(DESKTOP_LYRICS_COLOR_KEY) ||
			DEFAULT_LYRICS_HIGHLIGHT_COLOR
		)
	} catch {
		return DEFAULT_LYRICS_HIGHLIGHT_COLOR
	}
}

export function setLyricsHighlightColor(color: string): void {
	try {
		localStorage.setItem(LYRICS_HIGHLIGHT_COLOR_KEY, color)
		localStorage.setItem(DESKTOP_LYRICS_COLOR_KEY, color)
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyrics-highlight-color-change', {
				detail: { color },
			}),
		)
		window.dispatchEvent(
			new CustomEvent('bbplayer:desktop-lyrics-color-change', {
				detail: { color },
			}),
		)
		import('@tauri-apps/api/event')
			.then(({ emit }) => {
				emit('lyrics-sync', {
					type: 'STYLE_UPDATE',
					primaryColor: color,
				}).catch(() => {})
			})
			.catch(() => {})
	} catch {}
}

export const getDesktopLyricsColor = getLyricsHighlightColor
export const setDesktopLyricsColor = setLyricsHighlightColor

// -------------------------------------------------------------
// 歌曲专属搜索候选与已采用歌词记忆缓存
// -------------------------------------------------------------
export interface TrackSearchCache {
	candidates: LyricSearchCandidate[]
	adoptedId?: string | number | null
	adoptedSource?: string
	searchKeyword?: string
	updatedAt: number
}

const LYRIC_TRACK_CACHE_PREFIX = 'bbplayer_track_lyric_cache_'

export function getStoredTrackSearchCache(trackKey: string): TrackSearchCache | null {
	try {
		const raw = localStorage.getItem(LYRIC_TRACK_CACHE_PREFIX + trackKey)
		if (!raw) return null
		return JSON.parse(raw) as TrackSearchCache
	} catch {
		return null
	}
}

export function setStoredTrackSearchCache(trackKey: string, cache: TrackSearchCache): void {
	try {
		localStorage.setItem(LYRIC_TRACK_CACHE_PREFIX + trackKey, JSON.stringify(cache))
	} catch {}
}

export function markTrackAdoptedCandidate(
	trackKey: string,
	candidate: LyricSearchCandidate,
	allCandidates: LyricSearchCandidate[],
	keyword?: string,
): void {
	try {
		const cache: TrackSearchCache = {
			candidates: allCandidates,
			adoptedId: candidate.id,
			adoptedSource: candidate.source,
			searchKeyword: keyword,
			updatedAt: Date.now(),
		}
		setStoredTrackSearchCache(trackKey, cache)
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
			if (!content || content === '//') continue
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

	/**
	 * 当使用 QQ 音乐作为主歌词源时，由于 QQ 音乐官方不提供罗马音(romalrc)且部分曲目缺少翻译，
	 * 该方法负责从网易云音乐静默查询同一首歌的罗马音与翻译，与 QQ 音乐原文进行精准时间轴融合。
	 */
	private async fetchComplementaryNeteaseData(
		title: string,
		artist: string,
		needRomaji: boolean,
		needTrans: boolean,
		targetDurationSec?: number,
	): Promise<{ romalrc?: string; tlyric?: string }> {
		if (!needRomaji && !needTrans) return {}
		try {
			const nSearch = await neteaseApi.search({
				keywords: `${title} ${artist}`.trim(),
				limit: 5,
			})
			if (nSearch.isOk() && nSearch.value.length > 0) {
				const candidates = nSearch.value
				// 优先挑选时长相差 <= 15 秒的同版本曲目
				const matched =
					(targetDurationSec &&
						targetDurationSec > 0 &&
						candidates.find(
							(c) =>
								c.duration && Math.abs(c.duration - targetDurationSec) <= 15,
						)) ||
					candidates[0]!

				const nLyricRes = await neteaseApi.getLyrics(
					matched.remoteId as number,
				)
				if (nLyricRes.isOk()) {
					const nParsed = neteaseApi.parseLyrics(nLyricRes.value)
					return {
						romalrc: needRomaji ? nParsed.romalrc : undefined,
						tlyric: needTrans ? nParsed.tlyric : undefined,
					}
				}
			}
		} catch {}
		return {}
	}

	private async tryFetchQQMusic(
		keyword: string,
		trackKey: string,
		trackDuration: number,
		options?: { showTranslation?: boolean; showRomaji?: boolean },
	): Promise<UnifiedLyricResult | null> {
		try {
			const qqSearchRes = await qqMusicApi.search(keyword, 5)
			if (qqSearchRes.isOk() && qqSearchRes.value.length > 0) {
				const bestMatch = qqSearchRes.value[0]!
				const lyricRes = await qqMusicApi.getLyrics(bestMatch.remoteId as string)
				if (lyricRes.isOk()) {
					const parsedData = qqMusicApi.parseLyrics(lyricRes.value)
					if (parsedData.lrc) {
						let trans = parsedData.tlyric
						let romalrc = parsedData.romalrc

						const showRoma = options?.showRomaji ?? getLyricOptionRomaji()
						const showTrans = options?.showTranslation ?? getLyricOptionTranslation()

						// 若用户需要罗马音或翻译，且 QQ 音乐自身缺少，从网易云补全
						if ((showRoma && !romalrc) || (showTrans && !trans)) {
							const complement = await this.fetchComplementaryNeteaseData(
								bestMatch.title,
								bestMatch.artist,
								showRoma && !romalrc,
								showTrans && !trans,
								bestMatch.duration || trackDuration,
							)
							if (!romalrc && complement.romalrc) romalrc = complement.romalrc
							if (!trans && complement.tlyric) trans = complement.tlyric
						}

						this.rawCache.set(trackKey, {
							lrc: parsedData.lrc,
							tlyric: trans,
							romalrc,
							source: 'qqmusic',
							title: bestMatch.title,
							artist: bestMatch.artist,
						})

						const splText = mergeLyricsToSpl(
							parsedData.lrc,
							trans,
							romalrc,
							options,
						)

						return {
							trackKey,
							splContent: splText,
							source: 'qqmusic',
							title: bestMatch.title,
							artist: bestMatch.artist,
							offsetMs: getStoredLyricOffset(trackKey),
						}
					}
				}
			}
		} catch (err) {
			console.warn('QQ Music lyric fetch skipped:', err)
		}
		return null
	}

	private async tryFetchNetease(
		keyword: string,
		trackKey: string,
		options?: { showTranslation?: boolean; showRomaji?: boolean },
	): Promise<UnifiedLyricResult | null> {
		try {
			const neteaseSearchRes = await neteaseApi.search({
				keywords: keyword,
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
							offsetMs: getStoredLyricOffset(trackKey),
						}
					}
				}
			}
		} catch (err) {
			console.warn('Netease lyric fetch skipped:', err)
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

		// 若关闭了自动匹配歌词，且不是用户主动触发重新匹配 (forceFresh)，则跳过在线搜索
		if (!forceFresh && !getAutoMatchLyricsEnabled()) {
			return null
		}

		let queryTitle = cleanTrackTitle(track.title) || track.title
		let queryArtist =
			track.artist?.name && track.artist.name !== '未知UP主' && track.artist.name !== '未知歌手'
				? track.artist.name
				: ''

		if (track.source === 'bilibili') {
			const bili = track as BilibiliTrack
			if (bili.bilibiliMetadata?.isMultiPage && bili.bilibiliMetadata?.pagePart) {
				queryTitle = cleanTrackTitle(bili.bilibiliMetadata.pagePart) || bili.bilibiliMetadata.pagePart
			}
			if (bili.bilibiliMetadata?.mainTrackTitle) {
				const mainClean = cleanTrackTitle(bili.bilibiliMetadata.mainTrackTitle)
				const possibleArtist = mainClean.split(/[\s·-]+/)[0]
				if (possibleArtist && !queryTitle.includes(possibleArtist) && possibleArtist.length >= 2) {
					queryArtist = possibleArtist
				}
			}
		}

		const searchKeyword = `${queryTitle} ${queryArtist}`.trim()
		const preferredSource = getPreferredLyricSource()

		if (preferredSource === 'netease') {
			// 网易云优先
			const neteaseResult = await this.tryFetchNetease(searchKeyword, trackKey, options)
			if (neteaseResult) return neteaseResult

			// 回退 QQ 音乐
			const qqResult = await this.tryFetchQQMusic(searchKeyword, trackKey, track.duration, options)
			if (qqResult) return qqResult
		} else {
			// 默认 QQ 音乐优先
			const qqResult = await this.tryFetchQQMusic(searchKeyword, trackKey, track.duration, options)
			if (qqResult) return qqResult

			// 回退 网易云
			const neteaseResult = await this.tryFetchNetease(searchKeyword, trackKey, options)
			if (neteaseResult) return neteaseResult
		}

		return null
	}

	private candidateRawCache = new Map<string, Promise<RawLyricEntry | null>>()

	// 预加载候选歌曲原始歌词数据，保持原始对象不与固定 options 绑定
	prefetchCandidates(candidates: LyricSearchCandidate[]): void {
		candidates.slice(0, 8).forEach((cand) => {
			const cacheKey = `${cand.source}_${cand.id}`
			if (!this.candidateRawCache.has(cacheKey)) {
				this.candidateRawCache.set(cacheKey, this.fetchRawCandidate(cand))
			}
		})
	}

	// 2. Manual Candidate Search (支持音源筛选和按用户偏好排序)
	async searchCandidates(
		keyword: string,
		sourceFilter: PreferredLyricSource = 'all',
	): Promise<LyricSearchCandidate[]> {
		const cleanKw = keyword.trim()
		if (!cleanKw) return []

		const searchQQ = async (): Promise<LyricSearchCandidate[]> => {
			try {
				const qRes = await qqMusicApi.search(cleanKw, sourceFilter === 'qqmusic' ? 12 : 8)
				if (qRes.isOk()) {
					return qRes.value.map((item) => ({
						source: 'qqmusic' as const,
						id: item.remoteId,
						title: item.title,
						artist: item.artist,
						duration: item.duration,
					}))
				}
			} catch (err) {
				console.warn('QQ Music search error:', err)
			}
			return []
		}

		const searchNetease = async (): Promise<LyricSearchCandidate[]> => {
			try {
				const nRes = await Promise.race([
					neteaseApi.search({ keywords: cleanKw, limit: sourceFilter === 'netease' ? 12 : 8 }),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('Netease search timeout')), 12000),
					),
				])
				if (nRes.isOk()) {
					return nRes.value.map((item) => ({
						source: 'netease' as const,
						id: item.remoteId,
						title: item.title,
						artist: item.artist,
						duration: item.duration,
					}))
				}
			} catch (err) {
				console.warn('Netease search error:', err)
			}
			return []
		}

		if (sourceFilter === 'qqmusic') {
			return await searchQQ()
		}
		if (sourceFilter === 'netease') {
			return await searchNetease()
		}

		// 'all' 模式：两者并行请求，并根据全局偏好排序
		const preferred = getPreferredLyricSource()
		const [qqResults, neteaseResults] = await Promise.all([searchQQ(), searchNetease()])

		if (preferred === 'netease') {
			return [...neteaseResults, ...qqResults]
		}
		return [...qqResults, ...neteaseResults]
	}

	private async fetchRawCandidate(
		candidate: LyricSearchCandidate,
	): Promise<RawLyricEntry | null> {
		if (candidate.source === 'qqmusic') {
			try {
				const res = await qqMusicApi.getLyrics(String(candidate.id))
				if (res.isOk()) {
					const parsedData = qqMusicApi.parseLyrics(res.value)
					if (parsedData.lrc) {
						let trans = parsedData.tlyric
						let romalrc = parsedData.romalrc

						// 若缺少翻译或罗马音，尝试从网易云补全
						if (!trans || !romalrc) {
							const complement = await this.fetchComplementaryNeteaseData(
								candidate.title,
								candidate.artist,
								!romalrc,
								!trans,
								candidate.duration,
							)
							if (!romalrc && complement.romalrc) romalrc = complement.romalrc
							if (!trans && complement.tlyric) trans = complement.tlyric
						}

						return {
							lrc: parsedData.lrc,
							tlyric: trans,
							romalrc,
							source: 'qqmusic',
							title: candidate.title,
							artist: candidate.artist,
						}
					}
				}
			} catch (e) {
				console.error('Fetch qqmusic raw candidate error:', e)
			}
		} else if (candidate.source === 'netease') {
			try {
				const res = await neteaseApi.getLyrics(Number(candidate.id))
				if (res.isOk()) {
					const parsedData = neteaseApi.parseLyrics(res.value)
					if (parsedData.lrc) {
						return {
							lrc: parsedData.lrc,
							tlyric: parsedData.tlyric,
							romalrc: parsedData.romalrc,
							source: 'netease',
							title: candidate.title,
							artist: candidate.artist,
						}
					}
				}
			} catch (e) {
				console.error('Fetch netease raw candidate error:', e)
			}
		}
		return null
	}

	// 3. Fetch candidate's lyrics with translation and romaji options (基于原始歌词实时组合)
	async fetchCandidateLyrics(
		candidate: LyricSearchCandidate,
		options?: { showTranslation?: boolean; showRomaji?: boolean },
		trackKey?: string,
	): Promise<string | null> {
		const cacheKey = `${candidate.source}_${candidate.id}`
		let rawPromise = this.candidateRawCache.get(cacheKey)
		if (!rawPromise) {
			rawPromise = this.fetchRawCandidate(candidate)
			this.candidateRawCache.set(cacheKey, rawPromise)
		}
		const raw = await rawPromise
		if (!raw || !raw.lrc) return null

		if (trackKey) {
			this.rawCache.set(trackKey, raw)
		}

		return mergeLyricsToSpl(raw.lrc, raw.tlyric, raw.romalrc, options)
	}

	public getPreferredLyricSource = getPreferredLyricSource
	public setPreferredLyricSource = setPreferredLyricSource
	public getAutoMatchLyricsEnabled = getAutoMatchLyricsEnabled
	public setAutoMatchLyricsEnabled = setAutoMatchLyricsEnabled
	public getStoredCustomLyric = getStoredCustomLyric
	public getStoredLyricOffset = getStoredLyricOffset
}

export const lyricService = new LyricService()
