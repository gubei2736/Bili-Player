import { bilibiliApi, useHistoryStore, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { desktopAudioEngine } from './DesktopAudioEngine'
import { getAudioQualityPreference } from './audioSettings'
import { invoke } from '@tauri-apps/api/core'

let currentLoadingTrackKey: string | null = null
let latestPlayRequestId = 0

export async function playTrackWithProxy(track: Track, forceReplay = false): Promise<void> {
	// 1. 防重保护：如果相同曲目已在加载中，直接返回，避免并发打断与二次重播从 0 秒开始
	if (!forceReplay && currentLoadingTrackKey === track.uniqueKey) {
		return
	}
	const currentPlaying = desktopAudioEngine.getCurrentTrack()
	if (
		!forceReplay &&
		currentPlaying?.uniqueKey === track.uniqueKey &&
		desktopAudioEngine.isPlaying()
	) {
		return
	}

	currentLoadingTrackKey = track.uniqueKey
	const requestId = ++latestPlayRequestId

	try {
		if (track.source === 'bilibili') {
			const biliTrack = track as BilibiliTrack
			const bvid = biliTrack.bilibiliMetadata.bvid
			let cid = biliTrack.bilibiliMetadata.cid

			// 1.1 If cid is missing, fetch pagelist to resolve first page cid
			if (!cid) {
				const pageListRes = await bilibiliApi.getPageList({ bvid })
				if (requestId !== latestPlayRequestId) return // 已被新切歌请求取代
				if (pageListRes.isOk() && pageListRes.value.length > 0) {
					cid = pageListRes.value[0]!.cid
					biliTrack.bilibiliMetadata.cid = cid
				} else {
					throw new Error('无法获取该视频的分 P CID 信息')
				}
			}

			// 2. Fetch Audio Stream URL from Bilibili based on quality preference
			const qualityPref = getAudioQualityPreference()
			let audioQuality = 30280
			let enableHiRes = false
			let enableDolby = false
			let preferDolbyFirst = false

			if (qualityPref === 'auto_highest' || (qualityPref as any) === 'auto_hires') {
				audioQuality = 30280
				enableHiRes = true
				enableDolby = true
				preferDolbyFirst = false // 智能优先选择账号权限下最高档位清晰度：Hi-Res > 杜比 > 常规 AAC
			} else if (qualityPref === 'hires_lossless') {
				audioQuality = 30280
				enableHiRes = true
				enableDolby = false
				preferDolbyFirst = false
			} else if (qualityPref === 'dolby_atmos') {
				audioQuality = 30280
				enableHiRes = false
				enableDolby = true
				preferDolbyFirst = true
			} else if (qualityPref === 'standard_aac') {
				audioQuality = 30280
				enableHiRes = false
				enableDolby = false
				preferDolbyFirst = false
			}

			const streamRes = await bilibiliApi.getAudioStream({
				bvid,
				cid,
				audioQuality,
				enableDolby,
				enableHiRes,
				preferDolbyFirst,
			})

			// 如果在等待网络响应期间用户切换到了另一首歌，直接放弃旧请求
			if (requestId !== latestPlayRequestId) return

			if (streamRes.isErr()) {
				throw new Error(`获取 B 站音频流失败: ${streamRes.error.message}`)
			}

			const streamData = streamRes.value
			biliTrack.bilibiliMetadata.bilibiliStreamUrl = streamData

			// 3. Query local stream proxy port from Tauri backend
			let port = 0
			try {
				port = await invoke<number>('get_stream_proxy_port')
			} catch {
				// Fallback if running outside Tauri
			}

			if (requestId !== latestPlayRequestId) return

			let proxyUrl = streamData.url
			if (port > 0) {
				proxyUrl = `http://127.0.0.1:${port}/proxy?url=${encodeURIComponent(
					streamData.url,
				)}&bvid=${bvid}&cid=${cid}`
			}

			// 4. Calculate loudness normalization gain (dB)
			let loudnessDeltaDb = 0
			if (streamData.volume) {
				loudnessDeltaDb = streamData.volume.target_i - streamData.volume.measured_i
			}

			// 5. Hand over to Web Audio engine
			await desktopAudioEngine.loadAndPlay(track, proxyUrl, loudnessDeltaDb)
		} else {
			// Local track fallback
			const localTrack = track as any
			await desktopAudioEngine.loadAndPlay(
				track,
				localTrack.localMetadata?.localPath || '',
			)
		}

		// 6. 成功启动播放后记录到收听历史
		if (requestId === latestPlayRequestId) {
			useHistoryStore.getState().addRecord(track)
		}
	} finally {
		if (currentLoadingTrackKey === track.uniqueKey) {
			currentLoadingTrackKey = null
		}
	}
}