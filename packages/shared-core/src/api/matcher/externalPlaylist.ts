import { decode } from 'he'
import { errAsync, ResultAsync } from 'neverthrow'

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
			return this.nApi.getPlaylist(playlistId).map((response) => {
				if (!response.playlist) {
					return {
						playlist: {
							id: playlistId,
							title: 'Unknown Playlist',
							coverUrl: '',
							description: '',
							trackCount: 0,
							author: {
								name: 'Unknown',
								id: 0,
							},
						},
						tracks: [],
					}
				}

				const tracks = (response.playlist.tracks ?? []).map((track) => ({
					title: track.name,
					artists: track.ar.map((a) => a.name),
					album: track.al.name,
					duration: track.dt,
					coverUrl: track.al.picUrl.replace('http://', 'https://'),
					translatedTitle: track.tns?.[0],
				}))

				return {
					playlist: {
						id: response.playlist.id.toString(),
						title: response.playlist.name,
						coverUrl: response.playlist.coverImgUrl,
						description: response.playlist.description ?? '',
						trackCount: response.playlist.trackCount,
						author: {
							name: response.playlist.creator?.nickname ?? 'Unknown',
							id: response.playlist.creator?.userId ?? 0,
						},
					},
					tracks,
				}
			})
		} else if (source === 'qq') {
			return this.qApi.getPlaylist(playlistId).map((response) => {
				const playlist = response.data?.cdlist?.[0]
				if (!playlist) {
					return {
						playlist: {
							id: playlistId,
							title: 'Unknown',
							coverUrl: '',
							description: '',
							trackCount: 0,
							author: { name: 'Unknown' },
						},
						tracks: [],
					}
				}

				const tracks = playlist.songlist.map((track) => ({
					title: track.name,
					artists: track.singer.map((s) => s.name),
					album: track.album.name,
					duration: track.interval * 1000,
					coverUrl: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.mid}.jpg`,
					translatedTitle: track.subtitle,
				}))

				return {
					playlist: {
						id: playlistId,
						title: playlist.dissname,
						coverUrl: playlist.logo,
						description: playlist.desc || '',
						trackCount: playlist.songnum,
						author: {
							name: playlist.nickname,
						},
					},
					tracks,
				}
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
