import { bilibiliApi, useHistoryStore, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { desktopAudioEngine } from './DesktopAudioEngine'
import { getAudioQualityPreference } from './audioSettings'
import { invoke } from '@tauri-apps/api/core'

let currentLoadingTrackKey: string | null = null

export async function playTrackWithProxy(track: Track): Promise<void> {
	// 1. 防重保护：如果相同曲目已在加载中或正在播放，直接返回，避免并发打断与二次重播从 0 秒开始
	if (currentLoadingTrackKey === track.uniqueKey) {
		return
	}
	const currentPlaying = desktopAudioEngine.getCurrentTrack()
	if (currentPlaying?.uniqueKey === track.uniqueKey && desktopAudioEngine.isPlaying()) {
		return
	}

	currentLoadingTrackKey = track.uniqueKey

	try {
		if (track.source === 'bilibili') {
			const biliTrack = track as BilibiliTrack
			const bvid = biliTrack.bilibiliMetadata.bvid
			let cid = biliTrack.bilibiliMetadata.cid

			// 1.1 If cid is missing, fetch pagelist to resolve first page cid
			if (!cid) {
				const pageListRes = await bilibiliApi.getPageList({ bvid })
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

		if (qualityPref === 'auto_hires') {
			audioQuality = 30280
			enableHiRes = true
			enableDolby = true
		} else if (qualityPref === 'high_192k') {
			audioQuality = 30280
			enableHiRes = false
			enableDolby = false
		} else if (qualityPref === 'standard_132k') {
			audioQuality = 30232
			enableHiRes = false
			enableDolby = false
		}

		const streamRes = await bilibiliApi.getAudioStream({
			bvid,
			cid,
			audioQuality,
			enableDolby,
			enableHiRes,
		})

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
		await desktopAudioEngine.loadAndPlay(track, localTrack.localMetadata?.localPath || '')
	}

	// 6. 成功启动播放后记录到收听历史
	useHistoryStore.getState().addRecord(track)
	} finally {
		if (currentLoadingTrackKey === track.uniqueKey) {
			currentLoadingTrackKey = null
		}
	}
}
