import { decode } from 'he'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { bilibiliApi, type BilibiliApi } from '../bilibili/api'
import { neteaseApi, type NeteaseApi } from '../netease/api'
import { qqMusicApi, type QQMusicApi } from '../qqmusic/api'
import type { BilibiliSearchVideo } from '../../types/bilibili'
import type { GenericPlaylist, GenericTrack } from '../../types/playlist'
import {
	cleanString,
	gaussian,
	lcsScore,
	parseDurationString,
} from './matching'

const MIN_DELAY = 1200
const SEARCH_TIMEOUT = 15_000
const BLACKLIST_ZONES = new Set([26, 29, 31, 201, 238])
const PRIORITY_ZONES = new Set([193, 130, 267])

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const createSearchSignal = (parentSignal?: AbortSignal) => {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT)
	const abortFromParent = () => controller.abort()

	if (parentSignal?.aborted) {
		controller.abort()
	} else {
		parentSignal?.addEventListener('abort', abortFromParent, { once: true })
	}

	return {
		signal: controller.signal,
		cleanup: () => {
			clearTimeout(timeoutId)
			parentSignal?.removeEventListener('abort', abortFromParent)
		},
	}
}

interface MatchCandidate {
	video: BilibiliSearchVideo
	score: number
}

export interface MatchResult {
	track: GenericTrack
	matchedVideo: BilibiliSearchVideo | null
}

export class ExternalPlaylistService {
	constructor(
		private readonly bApi: BilibiliApi = bilibiliApi,
		private readonly nApi: NeteaseApi = neteaseApi,
		private readonly qApi: QQMusicApi = qqMusicApi,
	) {}

	public fetchExternalPlaylist(
		playlistId: string,
		source: 'netease' | 'qq',
	): ResultAsync<{ playlist: GenericPlaylist; tracks: GenericTrack[] }, Error> {
		if (source === 'netease') {
			return this.nApi
				.getPlaylist(playlistId)
				.mapErr((err) => new Error(err.message || '获取网易云歌单网络异常'))
				.andThen((response) => {
					if (!response.playlist || !response.playlist.tracks || response.playlist.tracks.length === 0) {
						return errAsync(
							new Error('未找到网易云歌单或歌单为空/暂无公开权限，请检查歌单链接有效性'),
						)
					}

					const tracks = response.playlist.tracks.map((track) => ({
						title: track.name,
						artists: track.ar.map((a) => a.name),
						album: track.al.name,
						duration: track.dt,
						coverUrl: (track.al.picUrl || '').replace('http://', 'https://'),
						translatedTitle: track.tns?.[0],
					}))

					return okAsync({
						playlist: {
							id: response.playlist.id.toString(),
							title: response.playlist.name,
							coverUrl: response.playlist.coverImgUrl,
							description: response.playlist.description ?? '',
							trackCount: response.playlist.trackCount || tracks.length,
							author: {
								name: response.playlist.creator?.nickname ?? '网易云音乐人',
								id: response.playlist.creator?.userId ?? 0,
							},
						},
						tracks,
					})
				})
		} else if (source === 'qq') {
			return this.qApi.getPlaylist(playlistId).andThen((response) => {
				const playlist = response.data?.cdlist?.[0]
				if (!playlist || !playlist.songlist || playlist.songlist.length === 0) {
					return errAsync(
						new Error('未找到 QQ 音乐歌单或歌单为空/暂无公开权限，请检查歌单链接有效性'),
					)
				}

				const tracks = playlist.songlist.map((track) => ({
					title: track.name,
					artists: track.singer.map((s) => s.name),
					album: track.album?.name || '',
					duration: (track.interval || 180) * 1000,
					coverUrl: track.album?.mid
						? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.mid}.jpg`
						: '',
					translatedTitle: track.subtitle,
				}))

				return okAsync({
					playlist: {
						id: playlistId,
						title: playlist.dissname,
						coverUrl: playlist.logo,
						description: playlist.desc || '',
						trackCount: playlist.songnum || tracks.length,
						author: {
							name: playlist.nickname || 'QQ音乐用户',
						},
					},
					tracks,
				})
			})
		}
		return errAsync(new Error('Unsupported source: ' + String(source)))
	}

	public matchExternalPlaylist(
		tracks: GenericTrack[],
		onProgress: (
			current: number,
			total: number,
			result: MatchResult,
			trackIndex: number,
		) => void,
		options?: {
			signal?: AbortSignal
			startIndex?: number
			trackIndexes?: number[]
		},
	): ResultAsync<MatchResult[], Error> {
		return ResultAsync.fromPromise(
			(async () => {
				const results: MatchResult[] = []
				const total = tracks.length
				const startIndex = options?.startIndex ?? 0
				const indexesToProcess =
					options?.trackIndexes ??
					Array.from(
						{ length: Math.max(total - startIndex, 0) },
						(_, index) => startIndex + index,
					)
				const processingTotal = indexesToProcess.length

				for (const [processedCount, trackIndex] of indexesToProcess.entries()) {
					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const song = tracks[trackIndex]
					if (!song) {
						continue
					}
					await wait(MIN_DELAY)

					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const artistNames = song.artists.join(' ')
					const searchQuery = `${song.title} ${song.translatedTitle ?? ''} - ${artistNames}`

					let matchedVideo: BilibiliSearchVideo | null = null

					try {
						const { signal, cleanup } = createSearchSignal(options?.signal)
						const searchResult = await (async () => {
							try {
								return await this.bApi.searchVideos({
									keyword: searchQuery,
									page: 1,
									skipCookie: true,
									signal,
								})
							} finally {
								cleanup()
							}
						})()

						if (searchResult.isOk()) {
							const decodedResults = searchResult.value.result.map((video) => ({
								...video,
								title: decode(video.title),
							}))
							matchedVideo = this.findBestMatchSimple(decodedResults, song)
						}
					} catch {}

					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const result: MatchResult = {
						track: song,
						matchedVideo,
					}
					results.push(result)
					onProgress(processedCount + 1, processingTotal, result, trackIndex)
				}

				return results
			})(),
			(e) => (e instanceof Error ? e : new Error(String(e))),
		)
	}

	private findBestMatchSimple(
		results: BilibiliSearchVideo[],
		targetSong: GenericTrack,
	): BilibiliSearchVideo | null {
		const targetDurationSec = targetSong.duration / 1000

		for (const video of results) {
			if (BLACKLIST_ZONES.has(video.typeid)) {
				continue
			}

			const videoDurationSec = parseDurationString(video.duration)
			const durationDiff = Math.abs(videoDurationSec - targetDurationSec)

			if (durationDiff > 20) {
				continue
			}

			return video
		}

		return null
	}
}

export const externalPlaylistService = new ExternalPlaylistService()
