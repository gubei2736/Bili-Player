import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { getDefaultHttpClient, type IHttpClient } from '../http'
import type {
	BilibiliAudioStreamParams,
	BilibiliAudioStreamResponse,
	BilibiliCollection,
	BilibiliCollectionAllContents,
	BilibiliCommentsResponse,
	BilibiliDealFavoriteForOneVideoResponse,
	BilibiliFavoriteListAllContents,
	BilibiliFavoriteListContents,
	BilibiliFollowingGroup,
	BilibiliFollowingProfile,
	BilibiliFollowingsResponse,
	BilibiliGarbAssetBagResponse,
	BilibiliGarbBenefitResponse,
	BilibiliGarbSearchResponse,
	BilibiliGarbSuitDetailResponse,
	BilibiliHistoryVideo,
	BilibiliHotSearch,
	BilibiliMultipageVideo,
	BilibiliPlaylist,
	BilibiliReplyCommentsResponse,
	BilibiliSearchSuggestionItem,
	BilibiliSearchUser,
	BilibiliSearchVideo,
	BilibiliSeriesArchives,
	BilibiliSeriesMetadata,
	BilibiliSmsLoginData,
	BilibiliSmsSendData,
	BilibiliToViewVideoList,
	BilibiliUserInfo,
	BilibiliUserRelation,
	BilibiliUserUploadedVideosResponse,
	BilibiliVideoDetails,
	BilibiliWebPlayerInfo,
} from '../../types/bilibili'
import { BilibiliQrCodeLoginStatus } from '../../types/bilibili'
import type { BilibiliTrack } from '../../types/media'
import { bilibiliApiClient, type BilibiliApiClient } from './client'
import { BilibiliApiError } from './errors'
import { bv2av } from './utils'
import getWbiEncodedParams from './wbi'
import { getDefaultCookieProvider } from '../cookie'

const PASSPORT_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0'

export class BilibiliApi {
	constructor(
		private readonly client: BilibiliApiClient = bilibiliApiClient,
		private readonly http: IHttpClient = getDefaultHttpClient(),
	) {}

	private get activeHttp(): IHttpClient {
		return getDefaultHttpClient() || this.http
	}

	getHistory({ signal }: { signal?: AbortSignal } = {}): ResultAsync<
		BilibiliHistoryVideo[],
		BilibiliApiError
	> {
		return this.client.get<BilibiliHistoryVideo[]>({
			endpoint: '/x/v2/history',
			signal,
		})
	}

	getPopularVideos({
		partition,
		signal,
	}: {
		partition: string
		signal?: AbortSignal
	}): ResultAsync<BilibiliVideoDetails[], BilibiliApiError> {
		return this.client
			.get<{
				list: BilibiliVideoDetails[]
			} | null>({
				endpoint: `/x/web-interface/ranking/v2?rid=${partition}`,
				signal,
			})
			.map((response) => response?.list ?? [])
	}

	getFavoritePlaylists({
		userMid,
		signal,
	}: {
		userMid: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliPlaylist[], BilibiliApiError> {
		return this.client
			.get<{
				list: BilibiliPlaylist[] | null
			} | null>({
				endpoint: `/x/v3/fav/folder/created/list-all?up_mid=${userMid}`,
				signal,
			})
			.map((response) => response?.list ?? [])
	}

	createFavoriteFolder({
		title,
		intro,
		cover,
		privacy = 0,
	}: {
		title: string
		intro?: string
		cover?: string
		privacy?: 0 | 1
	}): ResultAsync<
		{ id: number; title: string; mid: number; fid: number },
		BilibiliApiError
	> {
		return this.client.postWithCsrf<{
			id: number
			fid: number
			mid: number
			title: string
		}>({
			endpoint: '/x/v3/fav/folder/add',
			payload: {
				title,
				intro: intro ?? '',
				privacy: String(privacy),
				cover: cover ?? '',
			},
		})
	}

	searchVideos({
		keyword,
		page,
		skipCookie,
		signal,
	}: {
		keyword: string
		page: number
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<
		{ result: BilibiliSearchVideo[]; numPages: number },
		BilibiliApiError
	> {
		const params = getWbiEncodedParams({
			keyword,
			search_type: 'video',
			page: page.toString(),
		})

		return params
			.andThen((encodedParams) => {
				return this.client.get<{
					result: BilibiliSearchVideo[]
					numPages: number
				}>({
					endpoint: '/x/web-interface/wbi/search/type',
					params: encodedParams,
					skipCookie,
					signal,
				})
			})
			.andThen((res) => {
				if (!res.result) {
					res.result = []
				}
				res.result = res.result.filter(
					(item) => item.type !== 'ketang' && !!item.bvid,
				)
				return okAsync(res)
			})
	}

	searchUsers({
		keyword,
		page = 1,
		skipCookie,
		signal,
	}: {
		keyword: string
		page?: number
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<
		{ result: BilibiliSearchUser[]; numPages: number },
		BilibiliApiError
	> {
		const params = getWbiEncodedParams({
			keyword,
			search_type: 'bili_user',
			page: page.toString(),
		})

		return params
			.andThen((encodedParams) => {
				return this.client.get<{
					result: BilibiliSearchUser[]
					numPages: number
				}>({
					endpoint: '/x/web-interface/wbi/search/type',
					params: encodedParams,
					skipCookie,
					signal,
				})
			})
			.andThen((res) => {
				if (!res.result) {
					res.result = []
				}
				return okAsync(res)
			})
	}

	getHotSearches({ signal }: { signal?: AbortSignal } = {}): ResultAsync<
		BilibiliHotSearch[],
		BilibiliApiError
	> {
		return this.client
			.get<{
				list: BilibiliHotSearch[]
			}>({
				endpoint: '/x/web-interface/wbi/search/square',
				params: { limit: '10' },
				signal,
			})
			.map((response) => response.list ?? [])
	}

	getSearchSuggestions({
		term,
		signal,
	}: {
		term: string
		signal?: AbortSignal
	}): ResultAsync<BilibiliSearchSuggestionItem[], BilibiliApiError> {
		return ResultAsync.fromPromise(
			this.http.fetch(
				`https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(term)}&highlight=`,
				{
					headers: {
						'User-Agent': PASSPORT_UA,
						Referer: 'https://www.bilibili.com/',
					},
					signal,
					credentials: 'omit',
				},
			),
			(error) =>
				new BilibiliApiError({
					message: error instanceof Error ? error.message : String(error),
					type: 'RequestFailed',
					cause: error,
				}),
		)
			.andThen((response) => {
				if (!response.ok) {
					return errAsync(
						new BilibiliApiError({
							message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
							msgCode: response.status,
							type: 'RequestFailed',
						}),
					)
				}
				return ResultAsync.fromPromise(
					response.json() as Promise<{
						code: number
						result: { tag: BilibiliSearchSuggestionItem[] }
					}>,
					(error) =>
						new BilibiliApiError({
							message: error instanceof Error ? error.message : String(error),
							type: 'ResponseFailed',
						}),
				)
			})
			.andThen((data) => {
				if (data.code !== 0) {
					return errAsync(
						new BilibiliApiError({
							message: `获取搜索建议失败: ${data.code}`,
							msgCode: data.code,
							type: 'RequestFailed',
						}),
					)
				}
				return okAsync(data.result.tag)
			})
	}

	getAudioStream(
		params: BilibiliAudioStreamParams,
	): ResultAsync<
		Exclude<BilibiliTrack['bilibiliMetadata']['bilibiliStreamUrl'], undefined>,
		BilibiliApiError
	> {
		const { bvid, cid, audioQuality, enableDolby, enableHiRes, preferDolbyFirst } = params
		// 4048 = 16 (DASH) + 64 (HDR) + 128 (4K) + 256 (Dolby) + 512 (8K) + 1024 (AV1) + 2048 (Dolby Vision)
		const fnval = '4048'
		const wbiParams = getWbiEncodedParams({
			bvid,
			cid: String(cid),
			fnval,
			fnver: '0',
			fourk: '1',
			qlt: String(audioQuality),
			voice_balance: '1',
		})

		return wbiParams
			.andThen((encodedParams) => {
				return this.client.get<BilibiliAudioStreamResponse>({
					endpoint: '/x/player/wbi/playurl',
					params: encodedParams,
				})
			})
			.andThen((response) => {
				const { dash, durl, volume } = response

				if (!dash) {
					if (!durl?.[0]) {
						return errAsync(
							new BilibiliApiError({
								message: '请求到的流数据不包含 dash 或 durl 任一字段',
								type: 'AudioStreamError',
							}),
						)
					}
					return okAsync({
						url: durl[0].url,
						quality: 114514,
						getTime: Date.now() + 60 * 1000,
						type: 'mp4' as const,
						volume,
					})
				}

				// 1. 如果用户优先选择杜比全景声，先尝试杜比，再降级 Hi-Res
				if (preferDolbyFirst) {
					if (enableDolby && dash?.dolby?.audio && dash.dolby.audio.length > 0) {
						const dolbyAudio = dash.dolby.audio[0]
						return okAsync({
							url: dolbyAudio.baseUrl,
							quality: dolbyAudio.id || 30250,
							bandwidth: dolbyAudio.bandwidth,
							codecs: dolbyAudio.codecs,
							getTime: Date.now() + 60 * 1000,
							type: 'dash' as const,
							volume,
						})
					}
					if (enableHiRes && dash?.flac?.audio) {
						return okAsync({
							url: dash.flac.audio.baseUrl,
							quality: dash.flac.audio.id || 30251,
							bandwidth: dash.flac.audio.bandwidth,
							codecs: dash.flac.audio.codecs,
							getTime: Date.now() + 60 * 1000,
							type: 'dash' as const,
							volume,
						})
					}
				} else {
					// 默认高保真音质金字塔：Hi-Res 无损 (FLAC) > 杜比全景声 (EC-3) > 常规最高档 AAC
					if (enableHiRes && dash?.flac?.audio) {
						return okAsync({
							url: dash.flac.audio.baseUrl,
							quality: dash.flac.audio.id || 30251,
							bandwidth: dash.flac.audio.bandwidth,
							codecs: dash.flac.audio.codecs,
							getTime: Date.now() + 60 * 1000,
							type: 'dash' as const,
							volume,
						})
					}

					if (enableDolby && dash?.dolby?.audio && dash.dolby.audio.length > 0) {
						const dolbyAudio = dash.dolby.audio[0]
						return okAsync({
							url: dolbyAudio.baseUrl,
							quality: dolbyAudio.id || 30250,
							bandwidth: dolbyAudio.bandwidth,
							codecs: dolbyAudio.codecs,
							getTime: Date.now() + 60 * 1000,
							type: 'dash' as const,
							volume,
						})
					}
				}

				// 2. 常规 AAC 音频流降级（按质量从高到低排序，优先选择权限内最高档位）
				if (!dash?.audio || dash.audio.length === 0) {
					return errAsync(
						new BilibiliApiError({
							message: '未找到有效的音频流数据',
							type: 'AudioStreamError',
						}),
					)
				}

				const getTime = Date.now() + 60 * 1000
				const sortedAudios = [...dash.audio].sort((a, b) => b.id - a.id)
				const targetAudio =
					dash.audio.find((audio) => audio.id === audioQuality) || sortedAudios[0]

				if (targetAudio) {
					return okAsync({
						url: targetAudio.baseUrl,
						quality: targetAudio.id,
						bandwidth: targetAudio.bandwidth,
						codecs: targetAudio.codecs,
						getTime,
						type: 'dash' as const,
						volume,
					})
				}

				return errAsync(
					new BilibiliApiError({
						message: '未能确定任何可用的音频流',
						type: 'AudioStreamError',
					}),
				)
			})
	}

	getPageList({
		bvid,
		signal,
	}: {
		bvid: string
		signal?: AbortSignal
	}): ResultAsync<BilibiliMultipageVideo[], BilibiliApiError> {
		return this.client.get<BilibiliMultipageVideo[]>({
			endpoint: '/x/player/pagelist',
			params: { bvid },
			signal,
		})
	}

	getUserInfo({ signal }: { signal?: AbortSignal } = {}): ResultAsync<
		BilibiliUserInfo,
		BilibiliApiError
	> {
		return this.client.get<BilibiliUserInfo>({
			endpoint: '/x/space/myinfo',
			signal,
		})
	}

	getUserNavInfo({ signal }: { signal?: AbortSignal } = {}): ResultAsync<
		{ isLogin: boolean; mid: number; uname: string; face: string },
		BilibiliApiError
	> {
		return this.client.get<{ isLogin: boolean; mid: number; uname: string; face: string }>({
			endpoint: '/x/web-interface/nav',
			signal,
		})
	}

	getOtherUserInfo({
		mid,
		signal,
	}: {
		mid: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliUserInfo, BilibiliApiError> {
		const params = getWbiEncodedParams({ mid: mid.toString() })
		return params.andThen((encodedParams) => {
			return this.client.get<BilibiliUserInfo>({
				endpoint: '/x/space/wbi/acc/info',
				params: encodedParams,
				signal,
			})
		})
	}

	getFavoriteListContents({
		favoriteId,
		pn,
		signal,
	}: {
		favoriteId: number
		pn: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliFavoriteListContents, BilibiliApiError> {
		return this.client.get<BilibiliFavoriteListContents>({
			endpoint: '/x/v3/fav/resource/list',
			params: {
				media_id: favoriteId.toString(),
				pn: pn.toString(),
				ps: '40',
			},
			signal,
		})
	}

	getFavoriteListAllContents({
		favoriteId,
		signal,
	}: {
		favoriteId: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliFavoriteListAllContents, BilibiliApiError> {
		return this.client
			.get<BilibiliFavoriteListAllContents>({
				endpoint: '/x/v3/fav/resource/ids',
				params: { media_id: favoriteId.toString() },
				signal,
			})
			.map((response) => response.filter((item) => item.type === 2))
	}

	getVideoDetails({
		bvid,
		signal,
	}: {
		bvid: string
		signal?: AbortSignal
	}): ResultAsync<BilibiliVideoDetails, BilibiliApiError> {
		return this.client.get<BilibiliVideoDetails>({
			endpoint: '/x/web-interface/view',
			params: { bvid },
			signal,
		})
	}

	getCollectionsList({
		pageNumber,
		mid,
		signal,
	}: {
		pageNumber: number
		mid: number
		signal?: AbortSignal
	}): ResultAsync<
		{ list: BilibiliCollection[]; count: number; hasMore: boolean },
		BilibiliApiError
	> {
		return this.client
			.get<{
				list: BilibiliCollection[]
				count: number
				has_more: boolean
			}>({
				endpoint: '/x/v3/fav/folder/collected/list',
				params: {
					pn: pageNumber.toString(),
					ps: '20',
					up_mid: mid.toString(),
					platform: 'web',
				},
				signal,
			})
			.map((response) => ({
				list: response.list ?? [],
				count: response.count,
				hasMore: response.has_more,
			}))
	}

	getCollectionAllContents({
		collectionId,
		signal,
	}: {
		collectionId: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliCollectionAllContents, BilibiliApiError> {
		return this.client.get<BilibiliCollectionAllContents>({
			endpoint: '/x/space/fav/season/list',
			params: {
				season_id: collectionId.toString(),
				ps: '20',
				pn: '1',
			},
			signal,
		})
	}

	getSeriesMetadata({
		seriesId,
		signal,
	}: {
		seriesId: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliSeriesMetadata['meta'], BilibiliApiError> {
		return this.client
			.get<BilibiliSeriesMetadata>({
				endpoint: '/x/series/series',
				params: { series_id: String(seriesId) },
				signal,
			})
			.map(({ meta }) => meta)
	}

	getSeriesArchivesPage({
		seriesId,
		mid,
		pageNumber,
		pageSize = 20,
		signal,
	}: {
		seriesId: number
		mid: number
		pageNumber: number
		pageSize?: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliSeriesArchives, BilibiliApiError> {
		return this.client.get<BilibiliSeriesArchives>({
			endpoint: '/x/series/archives',
			params: {
				mid: String(mid),
				series_id: String(seriesId),
				ps: String(pageSize),
				pn: String(pageNumber),
			},
			signal,
		})
	}

	dealFavoriteForOneVideo({
		bvid,
		addToFavoriteIds,
		delInFavoriteIds,
	}: {
		bvid: string
		addToFavoriteIds: string[]
		delInFavoriteIds: string[]
	}): ResultAsync<BilibiliDealFavoriteForOneVideoResponse, BilibiliApiError> {
		const avid = bv2av(bvid)
		const data = {
			rid: String(avid),
			add_media_ids: addToFavoriteIds.join(','),
			del_media_ids: delInFavoriteIds.join(','),
			type: '2',
		}
		return this.client.postWithCsrf<BilibiliDealFavoriteForOneVideoResponse>({
			endpoint: '/x/v3/fav/resource/deal',
			payload: data,
		})
	}

	getUserUploadedVideos({
		mid,
		pn,
		keyword,
		signal,
	}: {
		mid: number
		pn: number
		keyword?: string
		signal?: AbortSignal
	}): ResultAsync<BilibiliUserUploadedVideosResponse, BilibiliApiError> {
		const params = getWbiEncodedParams({
			mid: mid.toString(),
			pn: pn.toString(),
			keyword: keyword ?? '',
			ps: '30',
		})
		return params.andThen((encodedParams) => {
			return this.client.get<BilibiliUserUploadedVideosResponse>({
				endpoint: '/x/space/wbi/arc/search',
				params: encodedParams,
				signal,
			})
		})
	}

	getComments({
		bvid,
		next,
		mode = 3,
		signal,
	}: {
		bvid: string
		next: number
		mode?: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliCommentsResponse, BilibiliApiError> {
		const avid = bv2av(bvid)
		const params = getWbiEncodedParams({
			oid: avid.toString(),
			type: '1',
			mode: mode.toString(),
			pagination_str: JSON.stringify({ offset: next.toString() }),
			plat: '1',
			web_location: '1315875',
		})
		return params.andThen((encodedParams) => {
			return this.client.get<BilibiliCommentsResponse>({
				endpoint: '/x/v2/reply/wbi/main',
				params: encodedParams,
				signal,
			})
		})
	}

	getReplyComments({
		bvid,
		root,
		pn,
		ps = 10,
		signal,
	}: {
		bvid: string
		root: number
		pn: number
		ps?: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliReplyCommentsResponse, BilibiliApiError> {
		const avid = bv2av(bvid)
		return this.client.get<BilibiliReplyCommentsResponse>({
			endpoint: '/x/v2/reply/reply',
			params: {
				oid: avid.toString(),
				type: '1',
				root: root.toString(),
				pn: pn.toString(),
				ps: ps.toString(),
			},
			signal,
		})
	}

	getLoginQrCode(): ResultAsync<
		{ url: string; qrcode_key: string },
		BilibiliApiError
	> {
		return this.client
			.get<any>({
				endpoint: '',
				fullUrl:
					'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
			})
			.map((res) => {
				const payload = res?.qrcode_key ? res : res?.data ? res.data : res
				return {
					url: payload?.url ?? '',
					qrcode_key: payload?.qrcode_key ?? '',
				}
			})
	}

	pollQrCodeLoginStatus({
		qrcodeKey,
	}: {
		qrcodeKey: string
	}): ResultAsync<
		{ status: BilibiliQrCodeLoginStatus; cookies: string },
		BilibiliApiError
	> {
		const parseRawCookieHeader = (
			rawHeader: string,
			targetMap: Record<string, string>,
		) => {
			if (!rawHeader) return
			const parts = rawHeader.split(/[\r\n]+|;;\s*|;\s*/)
			const ignoredKeys = new Set([
				'path',
				'domain',
				'expires',
				'max-age',
				'samesite',
				'secure',
				'httponly',
				'priority',
			])
			for (const item of parts) {
				const eqIdx = item.indexOf('=')
				if (eqIdx > 0) {
					const k = item.substring(0, eqIdx).trim()
					const v = item.substring(eqIdx + 1).trim()
					if (k && !ignoredKeys.has(k.toLowerCase()) && !k.includes(',')) {
						targetMap[k] = v
					}
				}
			}
		}

		const reqFunction = async () => {
			const http = this.activeHttp
			const response = await http.fetch(
				`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}`,
				{
					method: 'GET',
					headers: {
						'User-Agent': PASSPORT_UA,
						Referer: 'https://passport.bilibili.com/',
					},
					credentials: 'omit',
				},
			)
			if (!response.ok) {
				throw new BilibiliApiError({
					message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
					msgCode: response.status,
					type: 'RequestFailed',
				})
			}
			const rawJson = (await response.json()) as any
			const outerCode = typeof rawJson?.code === 'number' ? rawJson.code : 0
			if (outerCode !== 0) {
				throw new BilibiliApiError({
					message: `获取二维码登录状态失败: ${outerCode}`,
					msgCode: outerCode,
					rawData: rawJson,
					type: 'ResponseFailed',
				})
			}

			const pollData = rawJson?.data ?? rawJson
			const code = Number(pollData?.code) as BilibiliQrCodeLoginStatus

			if (code !== BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_SUCCESS) {
				return {
					status: code,
					cookies: '',
				}
			}

			// Multi-source cookie aggregation
			const cookieMap: Record<string, string> = {}

			// 1. Direct query parameter extraction from data.url
			const dataUrl: string | undefined = pollData?.url
			if (dataUrl) {
				try {
					const parsed = new URL(dataUrl)
					parsed.searchParams.forEach((val, key) => {
						if (
							val &&
							['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'].includes(
								key,
							)
						) {
							cookieMap[key] = val
						}
					})
				} catch {
					// Fallback regex matching in case URL parsing fails
					const keys = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid']
					for (const k of keys) {
						const match = dataUrl.match(new RegExp(`[?&]${k}=([^&#]+)`))
						if (match?.[1]) {
							cookieMap[k] = decodeURIComponent(match[1])
						}
					}
				}
			}

			// 2. Collect from poll response Set-Cookie headers
			const pollCookies =
				response.headers.get('Set-Cookie') ||
				response.headers.get('set-cookie') ||
				''
			parseRawCookieHeader(pollCookies, cookieMap)

			// 3. If SESSDATA or bili_jct is still missing and dataUrl is provided, follow dataUrl
			if ((!cookieMap['SESSDATA'] || !cookieMap['bili_jct']) && dataUrl) {
				try {
					const crossRes = await http.fetch(dataUrl, {
						method: 'GET',
						headers: {
							'User-Agent': PASSPORT_UA,
							Referer: 'https://www.bilibili.com/',
						},
						credentials: 'omit',
					})
					const crossCookies =
						crossRes.headers.get('Set-Cookie') ||
						crossRes.headers.get('set-cookie') ||
						''
					parseRawCookieHeader(crossCookies, cookieMap)
				} catch {}
			}

			// 4. Also store refresh_token if available
			const refreshToken = pollData?.refresh_token
			if (refreshToken) {
				cookieMap['refresh_token'] = String(refreshToken)
			}

			const cookieString = Object.entries(cookieMap)
				.map(([k, v]) => `${k}=${v}`)
				.join('; ')

			// Set immediately in defaultCookieProvider
			try {
				const provider = getDefaultCookieProvider()
				if (provider && provider.setCookie) {
					provider.setCookie(cookieMap)
				}
			} catch {}

			return {
				status: BilibiliQrCodeLoginStatus.QRCODE_LOGIN_STATUS_SUCCESS,
				cookies: cookieString,
			}
		}

		return ResultAsync.fromPromise(reqFunction(), (error) => {
			if (error instanceof BilibiliApiError) return error
			return new BilibiliApiError({
				message: error instanceof Error ? error.message : String(error),
				type: 'ResponseFailed',
				cause: error,
			})
		})
	}

	searchGarbSkins({
		keyword,
		page = 1,
		pageSize = 5,
		signal,
	}: {
		keyword: string
		page?: number
		pageSize?: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliGarbSearchResponse, BilibiliApiError> {
		return this.client.get<BilibiliGarbSearchResponse>({
			endpoint: '/x/garb/v2/mall/home/search',
			params: {
				key_word: keyword,
				pn: String(page),
				ps: String(pageSize),
			},
			signal,
		})
	}

	fetchGarbAssetBag({
		actId,
		lotteryId,
		signal,
	}: {
		actId: number
		lotteryId: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliGarbAssetBagResponse, BilibiliApiError> {
		return this.client.get<BilibiliGarbAssetBagResponse>({
			endpoint: '/x/vas/dlc_act/asset_bag',
			params: {
				act_id: String(actId),
				lottery_id: String(lotteryId),
			},
			signal,
		})
	}

	fetchGarbSuitDetail({
		itemId,
		signal,
	}: {
		itemId: number
		signal?: AbortSignal
	}): ResultAsync<BilibiliGarbSuitDetailResponse, BilibiliApiError> {
		return this.client.get<BilibiliGarbSuitDetailResponse>({
			endpoint: '/x/garb/v2/mall/suit/detail',
			params: { item_id: String(itemId) },
			signal,
		})
	}

	fetchGarbBenefit({
		itemId,
		signal,
	}: {
		itemId: number | string
		signal?: AbortSignal
	}): ResultAsync<BilibiliGarbBenefitResponse, BilibiliApiError> {
		return this.client.get<BilibiliGarbBenefitResponse>({
			endpoint: '/x/garb/v2/user/suit/benefit',
			params: {
				item_id: String(itemId),
				part: 'emoji_package',
			},
			signal,
		})
	}
}

export const bilibiliApi = new BilibiliApi()
