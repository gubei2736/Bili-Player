import { decode } from 'he'
import { errAsync, ResultAsync } from 'neverthrow'

import { getDefaultHttpClient, type IHttpClient } from '../http'
import type {
	QQMusicLyricResponse,
	QQMusicPlaylistResponse,
	QQMusicSearchResponse,
} from '../../types/qqmusic'
import type {
	LyricProviderResponseData,
	LyricSearchResult,
} from '../../types/lyrics'

export class QQMusicApi {
	constructor(private readonly client?: IHttpClient) {}

	private get http(): IHttpClient {
		return this.client ?? getDefaultHttpClient()
	}

	search(
		keyword: string,
		limit = 10,
		signal?: AbortSignal,
	): ResultAsync<LyricSearchResult, Error> {
		const searchType = 0
		const pageNum = 1

		const body = {
			comm: {
				ct: '26',
				cv: '0',
				uin: '0',
			},
			req: {
				method: 'DoSearchForQQMusicDesktop',
				module: 'music.search.SearchCgiService',
				param: {
					grp: 1,
					num_per_page: limit,
					page_num: pageNum,
					query: keyword,
					search_type: searchType,
				},
			},
		}

		return ResultAsync.fromPromise(
			this.http
				.fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
					method: 'POST',
					body: JSON.stringify(body),
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
						Accept: 'application/json, text/plain, */*',
						'Content-Type': 'application/json;charset=utf-8',
						Referer: 'https://y.qq.com/',
					},
					signal,
				})
				.then(async (res) => {
					if (!res.ok) {
						throw new Error(`QQ Music API error: ${res.statusText}`)
					}
					return (await res.json()) as QQMusicSearchResponse
				}),
			(e) => new Error('Failed to search QQ Music', { cause: e }),
		).map((res) => {
			const list = res.req?.data?.body?.song?.list ?? []
			return list.map((song) => ({
				source: 'qqmusic' as const,
				duration: song.interval,
				title: song.name,
				artist: song.singer[0]?.name ?? 'Unknown',
				remoteId: song.mid,
			}))
		})
	}

	getLyrics(
		songmid: string,
		signal?: AbortSignal,
	): ResultAsync<QQMusicLyricResponse, Error> {
		const modernBody = {
			comm: {
				ct: '26',
				cv: '0',
				uin: '0',
			},
			req: {
				module: 'music.musichallSong.PlayLyricInfo',
				method: 'GetPlayLyricInfo',
				param: {
					songMID: songmid,
					trans: 1,
					roma: 1,
				},
			},
		}

		return ResultAsync.fromPromise(
			this.http
				.fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
					method: 'POST',
					body: JSON.stringify(modernBody),
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
						Accept: 'application/json, text/plain, */*',
						'Content-Type': 'application/json;charset=utf-8',
						Referer: 'https://y.qq.com/',
					},
					signal,
				})
				.then(async (res) => {
					if (res.ok) {
						const json = (await res.json()) as any
						const lyricData = json?.req?.data
						if (lyricData && (lyricData.lyric || lyricData.qrc)) {
							return {
								code: 0,
								retcode: 0,
								subcode: 0,
								lyric: lyricData.lyric || '',
								trans: lyricData.trans || '',
								roma: lyricData.roma || '',
							} as QQMusicLyricResponse
						}
					}

					// Fallback to classic fcg endpoint
					const fallbackUrl = `https://i.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8&nobase64=1`
					const fallbackRes = await this.http.fetch(fallbackUrl, {
						headers: { Referer: 'https://y.qq.com/' },
						signal,
					})
					if (!fallbackRes.ok) {
						throw new Error(`QQ Music API error: ${fallbackRes.statusText}`)
					}
					return (await fallbackRes.json()) as QQMusicLyricResponse
				}),
			(e) => new Error('Failed to fetch lyrics from QQ Music', { cause: e }),
		)
	}

	parseLyrics(response: QQMusicLyricResponse): LyricProviderResponseData {
		const decodeField = (str?: string): string | undefined => {
			if (!str || typeof str !== 'string' || !str.trim()) return undefined
			try {
				const binary = atob(str.trim())
				const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
				const decoded = new TextDecoder().decode(bytes)
				return decode(decoded)
			} catch {
				try {
					return decode(str)
				} catch {
					return str
				}
			}
		}

		return {
			lrc: decodeField(response.lyric),
			tlyric: decodeField(response.trans),
			romalrc: decodeField(response.roma),
		}
	}

	searchBestMatchedLyrics(
		keyword: string,
		durationMs: number,
		signal?: AbortSignal,
	): ResultAsync<LyricProviderResponseData, Error> {
		return this.search(keyword, 10, signal).andThen((songs) => {
			if (!songs || songs.length === 0) {
				return errAsync(new Error('No songs found on QQ Music'))
			}

			const targetDurationSeconds = Math.round(durationMs / 1000)
			let bestMatch = songs[0]
			const MAX_DURATION_DIFF = 3
			const candidates = songs.slice(0, 5)

			const exactMatch = candidates.find(
				(s) => Math.abs(s.duration - targetDurationSeconds) <= MAX_DURATION_DIFF,
			)

			if (exactMatch) {
				bestMatch = exactMatch
			}

			return this.getLyrics(bestMatch.remoteId as string, signal).map(
				(response) => this.parseLyrics(response),
			)
		})
	}

	getPlaylist(id: string): ResultAsync<QQMusicPlaylistResponse, Error> {
		const params = new URLSearchParams({
			type: '1',
			json: '1',
			utf8: '1',
			onlysong: '0',
			disstid: id,
			format: 'json',
			g_tk: '5381',
			loginUin: '0',
			hostUin: '0',
			inCharset: 'utf8',
			outCharset: 'utf-8',
			notice: '0',
			platform: 'yqq.json',
			needNewCode: '0',
		})
		const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?${params.toString()}`

		return ResultAsync.fromPromise(
			this.http
				.fetch(url, {
					headers: {
						Referer: 'https://y.qq.com/',
					},
				})
				.then(async (res) => {
					if (!res.ok) {
						throw new Error(`QQ Music API error: ${res.statusText}`)
					}
					return (await res.json()) as QQMusicPlaylistResponse
				}),
			(e) => new Error('Failed to fetch QQ Music playlist', { cause: e }),
		)
	}
}

export const qqMusicApi = new QQMusicApi()
