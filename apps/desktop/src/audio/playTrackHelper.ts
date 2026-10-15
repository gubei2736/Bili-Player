import {
	bilibiliApi,
	useHistoryStore,
	useQueueStore,
	type Track,
	type BilibiliTrack,
} from '@bbplayer/shared-core'
import { desktopAudioEngine } from './DesktopAudioEngine'
import { getAudioQualityPreference } from './audioSettings'
import { invoke } from '@tauri-apps/api/core'

let currentLoadingTrackKey: string | null = null
let latestPlayRequestId = 0
let cachedProxyPort: number | null = null

export async function playTrackWithProxy(inputTrack: Track, forceReplay = false): Promise<void> {
	// 1. 防重保护：如果相同曲目已在加载中，直接返回，避免并发打断与二次重播从 0 秒开始
	if (!forceReplay && currentLoadingTrackKey === inputTrack.uniqueKey) {
		return
	}
	const currentPlaying = desktopAudioEngine.getCurrentTrack()
	if (
		!forceReplay &&
		currentPlaying?.uniqueKey === inputTrack.uniqueKey &&
		desktopAudioEngine.isPlaying()
	) {
		return
	}

	const originalKey = inputTrack.uniqueKey
	currentLoadingTrackKey = inputTrack.uniqueKey
	const requestId = ++latestPlayRequestId

	try {
		if (inputTrack.source === 'bilibili') {
			// 克隆独立副本，避免直接修改入参导致引用脏检查问题
			const biliTrack: BilibiliTrack = {
				...(inputTrack as BilibiliTrack),
				bilibiliMetadata: {
					...(inputTrack as BilibiliTrack).bilibiliMetadata,
				},
			}
			const bvid = biliTrack.bilibiliMetadata.bvid
			let cid = biliTrack.bilibiliMetadata.cid
			const explicitPageIndex = biliTrack.bilibiliMetadata.pageIndex

			// 1.1 获取视频分 P 列表，识别多分 P 信息与当前目标 CID
			let extraMetadata: Partial<BilibiliTrack['bilibiliMetadata']> = {}
			let trackOverrides: { title?: string; duration?: number; uniqueKey?: string } | undefined

			if (!biliTrack.bilibiliMetadata.pages || biliTrack.bilibiliMetadata.pages.length === 0 || !cid) {
				const pageListRes = await bilibiliApi.getPageList({ bvid })
				if (requestId !== latestPlayRequestId) return // 已被新切歌请求取代
				if (pageListRes.isOk() && pageListRes.value.length > 0) {
					const pages = pageListRes.value.map((p) => ({
						cid: p.cid,
						page: p.page,
						part: p.part || `第${p.page}部分`,
						duration: p.duration,
					}))

					const isMulti = pages.length > 1
					// 核心修复：优先匹配显式传入的 cid 或 explicitPageIndex，绝不使用 || 1 短路回退到 P1！
					const currentPage =
						(cid !== null && cid !== undefined && pages.find((p) => p.cid === cid)) ||
						(explicitPageIndex !== undefined && pages.find((p) => p.page === explicitPageIndex)) ||
						pages[0]!

					cid = currentPage.cid
					const mainTitle = biliTrack.bilibiliMetadata.mainTrackTitle || biliTrack.title
					const newTitle = isMulti && currentPage.part ? currentPage.part : biliTrack.title
					const newDuration = currentPage.duration || biliTrack.duration
					const newKey = isMulti ? `bilibili_${bvid}_${currentPage.page}` : biliTrack.uniqueKey

					biliTrack.bilibiliMetadata.cid = cid
					biliTrack.bilibiliMetadata.isMultiPage = isMulti
					biliTrack.bilibiliMetadata.pageIndex = currentPage.page
					biliTrack.bilibiliMetadata.pagePart = currentPage.part
					biliTrack.bilibiliMetadata.pages = pages
					biliTrack.bilibiliMetadata.mainTrackTitle = mainTitle
					biliTrack.title = newTitle
					biliTrack.duration = newDuration
					biliTrack.uniqueKey = newKey
					currentLoadingTrackKey = newKey

					extraMetadata = {
						bvid,
						cid,
						isMultiPage: isMulti,
						pageIndex: currentPage.page,
						pagePart: currentPage.part,
						pages,
						mainTrackTitle: mainTitle,
					}
					trackOverrides = {
						title: newTitle,
						duration: newDuration,
						uniqueKey: newKey,
					}
				} else if (!cid) {
					throw new Error('无法获取该视频的分 P CID 信息')
				}
			} else {
				const pages = biliTrack.bilibiliMetadata.pages
				const isMulti = pages.length > 1 || Boolean(biliTrack.bilibiliMetadata.isMultiPage)
				// 优先通过 cid 精确命中分 P，其次通过 explicitPageIndex
				const matchedPage =
					(cid !== null && cid !== undefined && pages.find((p) => p.cid === cid)) ||
					(explicitPageIndex !== undefined && pages.find((p) => p.page === explicitPageIndex)) ||
					pages[0]

				if (matchedPage) {
					cid = matchedPage.cid
					biliTrack.bilibiliMetadata.cid = cid
					biliTrack.bilibiliMetadata.isMultiPage = isMulti
					biliTrack.bilibiliMetadata.pageIndex = matchedPage.page
					biliTrack.bilibiliMetadata.pagePart = matchedPage.part
					if (isMulti && matchedPage.part) {
						biliTrack.title = matchedPage.part
					}
					if (matchedPage.duration) {
						biliTrack.duration = matchedPage.duration
					}
					if (isMulti) {
						biliTrack.uniqueKey = `bilibili_${bvid}_${matchedPage.page}`
						currentLoadingTrackKey = biliTrack.uniqueKey
					}
				}

				extraMetadata = {
					bvid,
					cid,
					isMultiPage: isMulti,
					pageIndex: biliTrack.bilibiliMetadata.pageIndex,
					pagePart: biliTrack.bilibiliMetadata.pagePart,
					pages: biliTrack.bilibiliMetadata.pages,
					mainTrackTitle: biliTrack.bilibiliMetadata.mainTrackTitle || inputTrack.title,
				}
				trackOverrides = {
					title: biliTrack.title,
					duration: biliTrack.duration,
					uniqueKey: biliTrack.uniqueKey,
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
			} else if (qualityPref === 'hires_lossless' || (qualityPref as any) === 'high_192k') {
				audioQuality = 30280
				enableHiRes = qualityPref === 'hires_lossless'
				enableDolby = false
				preferDolbyFirst = false
			} else if (qualityPref === 'dolby_atmos') {
				audioQuality = 30280
				enableHiRes = false
				enableDolby = true
				preferDolbyFirst = true
			} else {
				audioQuality = 30232
				enableHiRes = false
				enableDolby = false
				preferDolbyFirst = false
			}

			const streamRes = await bilibiliApi.getAudioStream({
				bvid,
				cid: cid!,
				audioQuality,
				enableDolby,
				enableHiRes,
				preferDolbyFirst,
			})

			if (requestId !== latestPlayRequestId) return // 已被新切歌请求取代

			if (streamRes.isErr()) {
				throw new Error(`获取 B 站音频流失败: ${streamRes.error.message}`)
			}

			const streamData = streamRes.value
			biliTrack.bilibiliMetadata.bilibiliStreamUrl = streamData

			// 3. Query local stream proxy port from Tauri backend (使用模块全局静态缓存)
			if (cachedProxyPort === null || cachedProxyPort <= 0) {
				try {
					cachedProxyPort = await invoke<number>('get_stream_proxy_port')
				} catch {
					cachedProxyPort = 0
				}
			}

			if (requestId !== latestPlayRequestId) return

			let proxyUrl = streamData.url
			if (cachedProxyPort && cachedProxyPort > 0) {
				proxyUrl = `http://127.0.0.1:${cachedProxyPort}/proxy?url=${encodeURIComponent(
					streamData.url,
				)}&bvid=${bvid}&cid=${cid}`
			}

			// 4. Calculate loudness normalization gain (dB)
			let loudnessDeltaDb = 0
			if (streamData.volume) {
				loudnessDeltaDb = streamData.volume.target_i - streamData.volume.measured_i
			}

			// 5. 优先切歌出声：第一时间送入音频引擎播放（必须传入具有最新 title 与 pageIndex 的 biliTrack！）
			await desktopAudioEngine.loadAndPlay(biliTrack, proxyUrl, loudnessDeltaDb)

			if (requestId !== latestPlayRequestId) return

			// 6. 优先播放之后，再更新识别出的音频真实规格（320K/Hi-Res/杜比等）与分 P 选集信息
			useQueueStore.getState().updateTrackStream(originalKey, streamData, extraMetadata, trackOverrides)

			// 7. 广播全局切歌/音轨更新事件，通知所有 UI 组件（底栏、歌词、选集弹窗）同步更新
			window.dispatchEvent(
				new CustomEvent('bbplayer:track-updated', { detail: biliTrack }),
			)
			useHistoryStore.getState().addRecord(biliTrack)
		} else {
			// Local track fallback
			const localTrack = inputTrack as any
			await desktopAudioEngine.loadAndPlay(
				inputTrack,
				localTrack.localMetadata?.localPath || '',
			)
			if (requestId === latestPlayRequestId) {
				window.dispatchEvent(
					new CustomEvent('bbplayer:track-updated', { detail: inputTrack }),
				)
				useHistoryStore.getState().addRecord(inputTrack)
			}
		}
	} finally {
		if (
			currentLoadingTrackKey === inputTrack.uniqueKey ||
			currentLoadingTrackKey === originalKey
		) {
			currentLoadingTrackKey = null
		}
	}
}