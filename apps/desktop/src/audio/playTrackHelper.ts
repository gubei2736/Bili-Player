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
import { logMultipart } from '../utils/debugLogger'

interface CachedStreamInfo {
	streamData: any
	expireAt: number
}
const streamCache = new Map<string, CachedStreamInfo>()

/**
 * 后台静默预加载分 P 音频流缓存，使点击该分 P 时实现 0ms 秒播
 */
export function prefetchPartStream(bvid: string, cid: number): void {
	const cacheKey = `${bvid}_${cid}`
	if (streamCache.has(cacheKey)) return
	bilibiliApi
		.getAudioStream({
			bvid,
			cid,
			audioQuality: 30280,
			enableDolby: false,
			enableHiRes: false,
		})
		.then((res) => {
			if (res.isOk()) {
				streamCache.set(cacheKey, {
					streamData: res.value,
					expireAt: Date.now() + 30 * 60 * 1000,
				})
				logMultipart('playTrackHelper', '分 P 音频流预热成功', { bvid, cid })
			}
		})
}

let currentLoadingTrackKey: string | null = null
let latestPlayRequestId = 0
let cachedProxyPort: number | null = null

/**
 * 强一致同步器：直接在 apps/desktop 侧通过 useQueueStore.setState 强制将目标分 P 写入当前播放位置
 * 彻底解决 updateTrackStream 匹配不到 key 或并发更新滞后的问题
 */
export function syncTrackToQueueStore(
	updatedTrack: BilibiliTrack,
	originalKey?: string,
): void {
	const state = useQueueStore.getState()
	const queue = [...state.queue]
	let currentIndex = state.currentIndex
	const bvid = updatedTrack.bilibiliMetadata.bvid
	const cid = updatedTrack.bilibiliMetadata.cid
	const pageIndex = updatedTrack.bilibiliMetadata.pageIndex

	// 深拷贝一份全新的对象引用，确保 React / Zustand 100% 触发重渲染
	const freshTrack: BilibiliTrack = {
		...updatedTrack,
		bilibiliMetadata: {
			...updatedTrack.bilibiliMetadata,
		},
	}

	// 1. 优先检查队列里是否已经有完全对应这一 P 的曲目 (例如“播放全部分 P”展开后的列表)
	const exactIdx = queue.findIndex((t) => {
		if (t.uniqueKey === freshTrack.uniqueKey) return true
		if (originalKey && t.uniqueKey === originalKey) return true
		if (t.source === 'bilibili') {
			const bt = t as BilibiliTrack
			if (bt.bilibiliMetadata.bvid === bvid) {
				if (cid && String(bt.bilibiliMetadata.cid) === String(cid)) return true
				if (pageIndex && Number(bt.bilibiliMetadata.pageIndex) === Number(pageIndex))
					return true
			}
		}
		return false
	})

	if (exactIdx !== -1) {
		// 如果队列中同时存在多首同 bvid 的歌（比如已展开 134 首），直接把指针移到对应的 exactIdx (即目标分 P)！
		queue[exactIdx] = freshTrack
		currentIndex = exactIdx
	} else if (
		currentIndex >= 0 &&
		currentIndex < queue.length &&
		queue[currentIndex]?.source === 'bilibili' &&
		(queue[currentIndex] as BilibiliTrack).bilibiliMetadata.bvid === bvid
	) {
		// 2. 如果当前正在播的就是同一个 bvid（单条目模式，从 P1 切到 P4），原地把 queue[currentIndex] 替换为目标分 P
		queue[currentIndex] = freshTrack
	} else {
		// 3. 查找队列里是否有同 bvid 的条目
		const sameBvidIdx = queue.findIndex(
			(t) =>
				t.source === 'bilibili' &&
				(t as BilibiliTrack).bilibiliMetadata.bvid === bvid,
		)
		if (sameBvidIdx !== -1) {
			queue[sameBvidIdx] = freshTrack
			currentIndex = sameBvidIdx
		} else {
			// 4. 队列中完全没有这首歌（比如直接从搜索页打开分 P 弹窗点播），直接插入并设为当前播放
			const insertIdx =
				currentIndex >= 0 && currentIndex < queue.length
					? currentIndex + 1
					: queue.length
			queue.splice(insertIdx, 0, freshTrack)
			currentIndex = insertIdx
		}
	}

	logMultipart('syncTrackToQueueStore', '执行队列同步写入', {
		targetTitle: freshTrack.title,
		targetPage: freshTrack.bilibiliMetadata.pageIndex,
		targetCid: freshTrack.bilibiliMetadata.cid,
		exactIdx,
		oldCurrentIndex: state.currentIndex,
		newCurrentIndex: currentIndex,
		queueLength: queue.length,
	})

	// 直接调用 Zustand 底层 setState，同时写入 queue, currentIndex 和 currentTrack
	useQueueStore.setState({
		queue,
		currentIndex,
		currentTrack: freshTrack,
	})

	// 同步派发全局 DOM 事件，通知所有组件立即刷新
	window.dispatchEvent(
		new CustomEvent('bbplayer:track-updated', { detail: freshTrack }),
	)
}

export async function playTrackWithProxy(inputTrack: Track, forceReplay = false): Promise<void> {
	logMultipart('playTrackHelper', 'playTrackWithProxy 入参', {
		uniqueKey: inputTrack.uniqueKey,
		title: inputTrack.title,
		forceReplay,
		bvid: (inputTrack as any)?.bilibiliMetadata?.bvid,
		pageIndex: (inputTrack as any)?.bilibiliMetadata?.pageIndex,
		cid: (inputTrack as any)?.bilibiliMetadata?.cid,
	})

	// 1. 防重保护：如果相同曲目已在加载中，直接返回，避免并发打断与二次重播从 0 秒开始
	if (!forceReplay && currentLoadingTrackKey === inputTrack.uniqueKey) {
		logMultipart('playTrackHelper', '防重拦截：相同曲目正在加载中', inputTrack.uniqueKey)
		return
	}
	const currentPlaying = desktopAudioEngine.getCurrentTrack()
	if (
		!forceReplay &&
		currentPlaying?.uniqueKey === inputTrack.uniqueKey &&
		desktopAudioEngine.isPlaying()
	) {
		logMultipart('playTrackHelper', '防重拦截：相同曲目已在播放中', inputTrack.uniqueKey)
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
					const matchedByCid = cid !== null && cid !== undefined ? pages.find((p) => String(p.cid) === String(cid)) : undefined
					const matchedByPage = explicitPageIndex !== undefined && explicitPageIndex !== null ? pages.find((p) => Number(p.page) === Number(explicitPageIndex)) : undefined
					const currentPage = matchedByCid || matchedByPage || pages[0]!

					logMultipart('playTrackHelper', '分 P 列表动态解析匹配结果', {
						inputCid: cid,
						explicitPageIndex,
						matchedByCid: matchedByCid ? { page: matchedByCid.page, cid: matchedByCid.cid, part: matchedByCid.part } : null,
						matchedByPage: matchedByPage ? { page: matchedByPage.page, cid: matchedByPage.cid, part: matchedByPage.part } : null,
						selectedPage: currentPage.page,
						selectedPart: currentPage.part,
					})

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
				} else if (!cid) {
					throw new Error('无法获取该视频的分 P CID 信息')
				}
			} else {
				const pages = biliTrack.bilibiliMetadata.pages
				const isMulti = pages.length > 1 || Boolean(biliTrack.bilibiliMetadata.isMultiPage)
				// 优先通过 cid 精确命中分 P，其次通过 explicitPageIndex
				const matchedByCid = cid !== null && cid !== undefined ? pages.find((p) => String(p.cid) === String(cid)) : undefined
				const matchedByPage = explicitPageIndex !== undefined && explicitPageIndex !== null ? pages.find((p) => Number(p.page) === Number(explicitPageIndex)) : undefined
				const matchedPage = matchedByCid || matchedByPage || pages[0]

				logMultipart('playTrackHelper', '已有分 P 缓存匹配结果', {
					inputCid: cid,
					explicitPageIndex,
					matchedByCid: matchedByCid ? { page: matchedByCid.page, cid: matchedByCid.cid, part: matchedByCid.part } : null,
					matchedByPage: matchedByPage ? { page: matchedByPage.page, cid: matchedByPage.cid, part: matchedByPage.part } : null,
					selectedPage: matchedPage?.page,
					selectedPart: matchedPage?.part,
				})

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
			}

			// 关键步骤：在请求音频流之前，立即把解析好的分 P 写入 AudioEngine 和 QueueStore！
			// 彻底杜绝 BottomPlayerBar 用旧的 P1 反向触发播放，0ms 瞬间切换 UI
			logMultipart('playTrackHelper', '即将同步分 P 到引擎与队列', {
				title: biliTrack.title,
				pageIndex: biliTrack.bilibiliMetadata.pageIndex,
				cid: biliTrack.bilibiliMetadata.cid,
				uniqueKey: biliTrack.uniqueKey,
			})
			desktopAudioEngine.setActiveTrack(biliTrack)
			syncTrackToQueueStore(biliTrack, originalKey)

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

			const cacheKey = `${bvid}_${cid}`
			let streamData: any = null
			const cached = streamCache.get(cacheKey)

			if (cached && cached.expireAt > Date.now()) {
				streamData = cached.streamData
				logMultipart('playTrackHelper', '命中内存音频流缓存，0ms 秒切进入播放', {
					bvid,
					cid,
					pageIndex: biliTrack.bilibiliMetadata.pageIndex,
				})
			} else {
				logMultipart('playTrackHelper', '开始请求音频流', { bvid, cid })
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

				streamData = streamRes.value
				streamCache.set(cacheKey, {
					streamData,
					expireAt: Date.now() + 30 * 60 * 1000,
				})
			}

			biliTrack.bilibiliMetadata.bilibiliStreamUrl = streamData

			// 3. Query local stream proxy port from Tauri backend (使用模块全局静态缓存，带异步就绪重试)
			if (cachedProxyPort === null || cachedProxyPort <= 0) {
				for (let attempt = 0; attempt < 5; attempt++) {
					try {
						const p = await invoke<number>('get_stream_proxy_port')
						if (p && p > 0) {
							cachedProxyPort = p
							break
						}
					} catch {}
					await new Promise((r) => setTimeout(r, 80))
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
			logMultipart('playTrackHelper', '即将进入 loadAndPlay', {
				title: biliTrack.title,
				pageIndex: biliTrack.bilibiliMetadata.pageIndex,
				cid: biliTrack.bilibiliMetadata.cid,
				proxyUrl: proxyUrl.substring(0, 80) + '...',
			})
			await desktopAudioEngine.loadAndPlay(biliTrack, proxyUrl, loudnessDeltaDb)

			if (requestId !== latestPlayRequestId) return

			// 6. 播放成功后再次同步包含音质规格的完整 biliTrack 到 Store
			logMultipart('playTrackHelper', 'loadAndPlay 成功，执行最终同步', {
				title: biliTrack.title,
				pageIndex: biliTrack.bilibiliMetadata.pageIndex,
			})
			syncTrackToQueueStore(biliTrack, originalKey)
			useHistoryStore.getState().addRecord(biliTrack)

			// 7. 预加载相邻分 P 流：如果是多 P 视频，后台静默预热下一 P，彻底消除切歌等待
			if (biliTrack.bilibiliMetadata.pages && biliTrack.bilibiliMetadata.pages.length > 1) {
				const curPage = biliTrack.bilibiliMetadata.pageIndex || 1
				const nextPart = biliTrack.bilibiliMetadata.pages.find((p) => Number(p.page) === Number(curPage + 1))
				if (nextPart && nextPart.cid) {
					prefetchPartStream(bvid, nextPart.cid)
				}
			}
		} else {
			// Local track fallback
			const localTrack = inputTrack as any
			desktopAudioEngine.setActiveTrack(inputTrack)
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
		currentLoadingTrackKey = null
	}
}