import { parseYrc } from '@bbplayer/splash'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import type {
	NeteaseLyricResponse,
	NeteasePlaylistResponse,
	NeteaseSearchResponse,
} from '../../types/netease'
import type {
	LyricProviderResponseData,
	LyricSearchResult,
} from '../../types/lyrics'
import { NeteaseApiError } from './errors'
import type { RequestOptions } from './request'
import { createRequest } from './request'
import { createOption } from './utils'
import { getDefaultHttpClient, type IHttpClient } from '../http'

export interface SearchParams {
	keywords: string
	type?: number | string
	limit?: number
	offset?: number
}

export class NeteaseApi {
	constructor(private readonly client?: IHttpClient) {}

	private get http(): IHttpClient {
		return this.client ?? getDefaultHttpClient()
	}

	getLyrics(
		id: number,
		signal?: AbortSignal,
	): ResultAsync<NeteaseLyricResponse, NeteaseApiError> {
		// 1. 优先使用极速稳定的官方明文歌词接口（自带主词、翻译与罗马音，防eapi风控阻断）
		const plaintextFetch = ResultAsync.fromPromise(
			this.http
				.fetch(
					`https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1&rv=-1`,
					{
						headers: {
							Referer: 'https://music.163.com/',
							'User-Agent':
								'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
						},
						signal,
					},
				)
				.then(async (res) => {
					if (!res.ok) {
						throw new Error(`Netease plaintext lyric error: ${res.statusText}`)
					}
					const json = await res.json()
					return {
						code: json.code || 200,
						lrc: json.lrc,
						klyric: json.klyric,
						tlyric: json.tlyric,
						romalrc: json.romalrc,
					} as NeteaseLyricResponse
				}),
			(e) =>
				new NeteaseApiError({
					message: '获取网易云明文歌词失败',
					type: 'RequestFailed',
					cause: e,
				}),
		)

		return plaintextFetch.orElse(() => {
			// 2. 回退到 eapi 加密接口
			const data = {
				id,
				lv: -1,
				tv: -1,
				rv: -1,
				kv: -1,
				yv: -1,
				os: 'ios',
				ver: 1,
			}
			const requestOptions: RequestOptions = createOption(
				{
					crypto: 'eapi',
					cookie: {
						os: 'ios',
						appver: '8.7.01',
						osver: '16.3',
						deviceId: '265B59C3-C5DE-4876-8A33-FD52CD5C2960',
					},
				},
				'eapi',
			)
			if (signal) {
				requestOptions.signal = signal
			}
			if (this.client) {
				requestOptions.client = this.client
			}

			return createRequest<object, NeteaseLyricResponse>(
				'/api/song/lyric/v1',
				data,
				requestOptions,
			).map((res) => res.body)
		})
	}

	search(
		params: SearchParams,
		signal?: AbortSignal,
	): ResultAsync<LyricSearchResult, NeteaseApiError> {
		const type = params.type ?? 1
		const limit = params.limit ?? 30
		const offset = params.offset ?? 0

		// 1. 对于单曲检索，优先使用响应极速且免加密风控的 Web 开放搜索接口
		if (type == 1) {
			const webSearchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(
				params.keywords,
			)}&type=1&offset=${offset}&total=true&limit=${limit}`

			const webSearchPromise = this.http
				.fetch(webSearchUrl, {
					headers: {
						Referer: 'https://music.163.com/',
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					},
					signal,
				})
				.then(async (res) => {
					if (!res.ok) {
						throw new Error(`Netease web search error: ${res.statusText}`)
					}
					const json = (await res.json()) as any
					const songs = json?.result?.songs ?? []
					return songs.map((song: any) => ({
						source: 'netease' as const,
						duration: (song.duration ?? song.dt ?? 0) / 1000,
						title: song.name,
						artist:
							song.artists?.[0]?.name ??
							song.ar?.[0]?.name ??
							'Unknown',
						remoteId: song.id,
					})) as LyricSearchResult
				})

			return ResultAsync.fromPromise(
				webSearchPromise,
				(e) =>
					new NeteaseApiError({
						message: '网易云开放接口搜索失败',
						type: 'RequestFailed',
						cause: e,
					}),
			).orElse(() => {
				// 若开放接口因网络异常失败，回退到 weapi 加密搜索
				return this.searchViaWeapi(params, signal)
			})
		}

		return this.searchViaWeapi(params, signal)
	}

	private searchViaWeapi(
		params: SearchParams,
		signal?: AbortSignal,
	): ResultAsync<LyricSearchResult, NeteaseApiError> {
		const type = params.type ?? 1
		const endpoint =
			type == '2000' ? '/api/search/voice/get' : '/api/cloudsearch/pc'

		const data = {
			type,
			limit: params.limit ?? 30,
			offset: params.offset ?? 0,
			...(type == '2000'
				? { keyword: params.keywords }
				: { s: params.keywords }),
		}

		const requestOptions: RequestOptions = createOption({}, 'weapi')
		if (signal) {
			requestOptions.signal = signal
		}
		if (this.client) {
			requestOptions.client = this.client
		}

		return createRequest<object, NeteaseSearchResponse>(
			endpoint,
			data,
			requestOptions,
		).map((res) => {
			if (!res.body.result?.songs) return []
			return res.body.result.songs.map((song: any) => ({
				source: 'netease' as const,
				duration: (song.dt ?? song.duration ?? 0) / 1000,
				title: song.name,
				artist: song.ar?.[0]?.name ?? song.artists?.[0]?.name ?? 'Unknown',
				remoteId: song.id,
			}))
		})
	}

	parseLyrics(
		lyricsResponse: NeteaseLyricResponse,
	): LyricProviderResponseData {
		const haveYrc = !!lyricsResponse.yrc?.lyric
		const lrc = haveYrc ? lyricsResponse.yrc!.lyric : (lyricsResponse.lrc?.lyric ?? '')
		const tlrc = haveYrc
			? lyricsResponse.ytlrc?.lyric
			: lyricsResponse.tlyric?.lyric
		const romalrc = haveYrc
			? lyricsResponse.yromalrc?.lyric
			: lyricsResponse.romalrc?.lyric

		const lyricData: LyricProviderResponseData = {
			lrc: parseYrc(lrc),
			tlyric: tlrc ? parseYrc(tlrc) : undefined,
			romalrc: romalrc ? parseYrc(romalrc) : undefined,
		}

		return lyricData
	}

	searchBestMatchedLyrics(
		keyword: string,
		_targetDurationMs: number,
		signal?: AbortSignal,
	): ResultAsync<LyricProviderResponseData, NeteaseApiError> {
		return this.search({ keywords: keyword, limit: 10 }, signal).andThen(
			(searchResult) => {
				if (searchResult.length === 0) {
					return errAsync(
						new NeteaseApiError({
							message: '未搜索到相关歌曲\n\n搜索关键词：' + keyword,
							type: 'SearchResultNoMatch',
						}),
					)
				}

				const bestMatch = searchResult[0]
				return this.getLyrics(bestMatch.remoteId as number, signal).andThen(
					(lyricsResponse) => {
						const lyricData = this.parseLyrics(lyricsResponse)
						return okAsync(lyricData)
					},
				)
			},
		)
	}

	getPlaylist(
		id: string,
	): ResultAsync<NeteasePlaylistResponse, NeteaseApiError> {
		// 1. 优先尝试标准 POST v3 详情接口与 GET 详情接口
		return ResultAsync.fromPromise(
			this.http
				.fetch(`https://music.163.com/api/v3/playlist/detail`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Referer: 'https://music.163.com/',
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
					},
					body: `id=${id}&n=1000&s=0`,
				})
				.then(async (res) => {
					if (!res.ok) throw new Error(`HTTP status ${res.status}`)
					const json = await res.json()
					const pl = json?.playlist || json?.result
					if (!json || json.code !== 200 || !pl) {
						throw new Error(json?.message || '歌单返回异常')
					}
					return { ...json, playlist: pl } as NeteasePlaylistResponse
				}),
			(e) =>
				new NeteaseApiError({
					message: '获取网易云歌单失败',
					type: 'RequestFailed',
					cause: e,
				}),
		)
			.orElse(() => {
				// 2. 尝试标准 GET 详情接口（部分 CDN 节点对 GET 更友好）
				return ResultAsync.fromPromise(
					this.http
						.fetch(`https://music.163.com/api/playlist/detail?id=${id}`, {
							method: 'GET',
							headers: {
								Referer: 'https://music.163.com/',
								'User-Agent':
									'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
							},
						})
						.then(async (res) => {
							if (!res.ok) throw new Error(`HTTP status ${res.status}`)
							const json = await res.json()
							const pl = json?.playlist || json?.result
							if (!json || json.code !== 200 || !pl) {
								throw new Error(json?.message || '歌单返回异常')
							}
							return { ...json, playlist: pl } as NeteasePlaylistResponse
						}),
					(e) =>
						new NeteaseApiError({
							message: '获取网易云歌单失败',
							type: 'RequestFailed',
							cause: e,
						}),
				)
			})
			.orElse(() => {
				// 3. 降级走原有的 eapi 请求
				const data = {
					s: '0',
					id,
					n: '1000',
					t: '0',
				}
				const requestOptions: RequestOptions = createOption({}, 'eapi')
				if (this.client) {
					requestOptions.client = this.client
				}

				return createRequest<object, NeteasePlaylistResponse>(
					'/api/v6/playlist/detail',
					data,
					requestOptions,
				).map((res) => {
					const pl = res.body.playlist || (res.body as any).result
					return { ...res.body, playlist: pl }
				})
			})
	}
}

export const neteaseApi = new NeteaseApi()
