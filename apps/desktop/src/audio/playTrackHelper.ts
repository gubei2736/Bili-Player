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
import { logDebug, logError, logMultipart } from '../utils/debugLogger'

interface CachedStreamInfo {
	streamData: any
	expireAt: number
}
const streamCache = new Map<string, CachedStreamInfo>()
export const pageListCache = new Map<string, any[]>()

let cachedProxyPort: number | null = null

async function getProxyPort(): Promise<number> {
	if (cachedProxyPort && cachedProxyPort > 0) return cachedProxyPort
	try {
		const p = await invoke<number>('get_stream_proxy_port')
		if (p && p > 0) {
			cachedProxyPort = p
			return p
		}
	} catch {}
	return 0
}

/**
 * 后台静默预加载音频流缓存（支持清晰度偏好智能匹配），使切歌时实现 0ms 秒播
 */
export function prefetchPartStream(bvid: string, cid: number, nextTrack?: Track): void {
	const cacheKey = `${bvid}_${cid}`
	if (streamCache.has(cacheKey)) {
		const cached = streamCache.get(cacheKey)!
		if (cached.expireAt > Date.now() && nextTrack) {
			getProxyPort().then((port) => {
				if (port > 0) {
					const proxyUrl = `http://127.0.0.1:${port}/proxy?url=${encodeURIComponent(
						cached.streamData.url,
					)}&bvid=${bvid}&cid=${cid}`
					let loudnessDeltaDb = 0
					if (
						cached.streamData.volume &&
						typeof cached.streamData.volume.measured_i === 'number'
					) {
						const target =
							typeof cached.streamData.volume.target_i === 'number'
								? cached.streamData.volume.target_i
								: -14.0
						loudnessDeltaDb = target - cached.streamData.volume.measured_i
					}
					desktopAudioEngine.preloadNextTrack(
						nextTrack,
						proxyUrl,
						loudnessDeltaDb,
					)
				}
			})
		}
		return
	}

	const qualityPref = getAudioQualityPreference()
	let audioQuality = 30280
	let enableHiRes = false
	let enableDolby = false
	let preferDolbyFirst = false

	if (qualityPref === 'auto_highest' || (qualityPref as any) === 'auto_hires') {
		audioQuality = 30280
		enableHiRes = true
		enableDolby = true
		preferDolbyFirst = false
	} else if (qualityPref === 'hires_lossless') {
		audioQuality = 30280
		enableHiRes = true
	} else if (qualityPref === 'dolby_atmos') {
		audioQuality = 30280
		enableDolby = true
		preferDolbyFirst = true
	} else {
		audioQuality = 30232
	}

	bilibiliApi
		.getAudioStream({
			bvid,
			cid,
			audioQuality,
			enableDolby,
			enableHiRes,
			preferDolbyFirst,
		})
		.then(async (res) => {
			if (res.isOk()) {
				streamCache.set(cacheKey, {
					streamData: res.value,
					expireAt: Date.now() + 30 * 60 * 1000,
				})
				logMultipart('playTrackHelper', '分 P / 下一首音频流预热成功', { bvid, cid })
				if (nextTrack) {
					const port = await getProxyPort()
					if (port > 0) {
						const proxyUrl = `http://127.0.0.1:${port}/proxy?url=${encodeURIComponent(
							res.value.url,
						)}&bvid=${bvid}&cid=${cid}`
						let loudnessDeltaDb = 0
						if (res.value.volume && typeof res.value.volume.measured_i === 'number') {
							const target =
								typeof res.value.volume.target_i === 'number'
									? res.value.volume.target_i
									: -14.0
							loudnessDeltaDb = target - res.value.volume.measured_i
						}
						desktopAudioEngine.preloadNextTrack(
							nextTrack,
							proxyUrl,
							loudnessDeltaDb,
						)
					}
				}
			}
		})
		.catch(() => {})
}

/**
 * 智能预热下一首：当前歌曲进入稳定播放后，异步静默预解析队列中下一首歌曲的 CID 与音频流
 */
let prefetchTimer: any = null
export function schedulePrefetchNextTrack(): void {
	if (prefetchTimer) clearTimeout(prefetchTimer)
	prefetchTimer = setTimeout(async () => {
		try {
			const { queue, currentIndex } = useQueueStore.getState()
			if (currentIndex < 0 || currentIndex >= queue.length - 1) return
			const nextTrack = queue[currentIndex + 1]
			if (!nextTrack || nextTrack.source !== 'bilibili') return

			const bt = nextTrack as BilibiliTrack
			const bvid = bt.bilibiliMetadata.bvid
			let cid = bt.bilibiliMetadata.cid

			if (!cid && pageListCache.has(bvid)) {
				const pages = pageListCache.get(bvid)!
				cid = pages[0]?.cid
			}

			if (!cid) {
				const res = await bilibiliApi.getPageList({ bvid })
				if (res.isOk() && res.value.length > 0) {
					pageListCache.set(bvid, res.value)
					cid = res.value[0]?.cid
				}
			}

			if (cid) {
				prefetchPartStream(bvid, cid, nextTrack)
			}
		} catch (err) {
			logDebug('playTrackHelper', '下一首静默预热捕获异常', err)
		}
	}, 1000)
}

let currentLoadingTrackKey: string | null = null
let latestPlayRequestId = 0

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

	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent('bbplayer:track-loading', {
				detail: { loading: true, track: inputTrack },
			}),
		)
	}

	// ⚡ 核心修复：切歌瞬间立即暂停上一首音频并广播状态，彻底消灭“4秒切歌期间还在播放旧歌”的问题！
	desktopAudioEngine.prepareTrackSwitch(inputTrack)

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

			// 1.1 获取视频分 P 列表，识别多分 P 信息与当前目标 CID（优先命中内存缓存）
			let pages = biliTrack.bilibiliMetadata.pages
			if ((!pages || pages.length === 0) && pageListCache.has(bvid)) {
				pages = pageListCache.get(bvid)
				biliTrack.bilibiliMetadata.pages = pages
			}

			if (!pages || pages.length === 0 || !cid) {
				const pageListRes = await bilibiliApi.getPageList({ bvid })
				if (requestId !== latestPlayRequestId) return // 已被新切歌请求取代
				if (pageListRes.isOk() && pageListRes.value.length > 0) {
					pages = pageListRes.value.map((p) => ({
						cid: p.cid,
						page: p.page,
						part: p.part || `第${p.page}部分`,
						duration: p.duration,
					}))
					pageListCache.set(bvid, pages)

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
				logDebug('playTrackHelper', '开始向 B 站 API 获取音频流 (getAudioStream)', { bvid, cid, audioQuality, enableDolby, enableHiRes })
				let streamRes = await bilibiliApi.getAudioStream({
					bvid,
					cid: cid!,
					audioQuality,
					enableDolby,
					enableHiRes,
					preferDolbyFirst,
				})

				if (streamRes.isErr()) {
					logDebug('playTrackHelper', `首次获取音频流异常，300ms 后自动重试: ${streamRes.error.message}`)
					await new Promise((r) => setTimeout(r, 300))
					if (requestId !== latestPlayRequestId) return
					streamRes = await bilibiliApi.getAudioStream({
						bvid,
						cid: cid!,
						audioQuality,
						enableDolby,
						enableHiRes,
						preferDolbyFirst,
					})
				}

				if (requestId !== latestPlayRequestId) {
					logDebug('playTrackHelper', '请求已被后续切歌取代，忽略本次响应', { bvid, cid })
					return
				}

				if (streamRes.isErr()) {
					logError('playTrackHelper', `获取 B 站音频流 API 返回错误: ${streamRes.error.message}`, streamRes.error)
					throw new Error(`获取 B 站音频流失败: ${streamRes.error.message}`)
				}

				streamData = streamRes.value
				logDebug('playTrackHelper', '成功获取 B 站原始音频流数据', {
					type: streamData.type,
					quality: streamData.quality,
					bandwidth: streamData.bandwidth,
					codecs: streamData.codecs,
					urlSample: streamData.url?.substring(0, 80) + '...',
				})

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
					} catch (portErr) {
						logDebug('playTrackHelper', `查询本地代理端口尝试 ${attempt + 1}/5 异常`, portErr)
					}
					await new Promise((r) => setTimeout(r, 80))
				}
			}

			logDebug('playTrackHelper', `本地流媒体代理端口确认: ${cachedProxyPort}`)

			if (requestId !== latestPlayRequestId) return

			let proxyUrl = streamData.url
			if (cachedProxyPort && cachedProxyPort > 0) {
				proxyUrl = `http://127.0.0.1:${cachedProxyPort}/proxy?url=${encodeURIComponent(
					streamData.url,
				)}&bvid=${bvid}&cid=${cid}`
			} else {
				logError('playTrackHelper', '警告：本地代理端口不可用，降级为直连 CDN（可能受限于防盗链与 CORS）')
			}

			// 4. Calculate loudness normalization gain (dB)
			let loudnessDeltaDb = 0
			if (streamData.volume && typeof streamData.volume.measured_i === 'number') {
				const target = typeof streamData.volume.target_i === 'number' ? streamData.volume.target_i : -14.0
				loudnessDeltaDb = target - streamData.volume.measured_i
			}

			// 5. 优先切歌出声：第一时间送入音频引擎播放（必须传入具有最新 title 与 pageIndex 的 biliTrack！）
			logDebug('playTrackHelper', '即将进入 desktopAudioEngine.loadAndPlay', {
				title: biliTrack.title,
				pageIndex: biliTrack.bilibiliMetadata.pageIndex,
				cid: biliTrack.bilibiliMetadata.cid,
				proxyUrl: proxyUrl.substring(0, 100) + '...',
			})
			await desktopAudioEngine.loadAndPlay(biliTrack, proxyUrl, loudnessDeltaDb)

			if (requestId !== latestPlayRequestId) return

			// 6. 播放成功后再次同步包含音质规格的完整 biliTrack 到 Store
			logDebug('playTrackHelper', 'loadAndPlay 执行完毕，同步状态到 QueueStore 与 HistoryStore', {
				title: biliTrack.title,
				pageIndex: biliTrack.bilibiliMetadata.pageIndex,
			})
			syncTrackToQueueStore(biliTrack, originalKey)
			useHistoryStore.getState().addRecord(biliTrack)

			// 7. 预加载相邻分 P 流与队列下一首：后台静默预热，彻底消除切歌等待
			schedulePrefetchNextTrack()
			if (biliTrack.bilibiliMetadata.pages && biliTrack.bilibiliMetadata.pages.length > 1) {
				const curPage = biliTrack.bilibiliMetadata.pageIndex || 1
				const nextPart = biliTrack.bilibiliMetadata.pages.find((p) => Number(p.page) === Number(curPage + 1))
				if (nextPart && nextPart.cid) {
					const nextPartTrack: BilibiliTrack = {
						...biliTrack,
						uniqueKey: `bilibili_${bvid}_${nextPart.page}`,
						title: nextPart.part || biliTrack.title,
						bilibiliMetadata: {
							...biliTrack.bilibiliMetadata,
							pageIndex: nextPart.page,
							cid: nextPart.cid,
							pagePart: nextPart.part,
						},
					}
					prefetchPartStream(bvid, nextPart.cid, nextPartTrack)
				}
			}
		} else {
			// 本地音频播放：无需匹配 B 站音源，直接通过本地流媒体代理服务器播放
			const localTrack = inputTrack as any
			const localPath = localTrack.localMetadata?.localPath || ''
			if (!localPath) {
				throw new Error('本地歌曲文件路径为空')
			}

			if (cachedProxyPort === null || cachedProxyPort <= 0) {
				for (let attempt = 0; attempt < 5; attempt++) {
					try {
						const p = await invoke<number>('get_stream_proxy_port')
						if (p && p > 0) {
							cachedProxyPort = p
							break
						}
					} catch (portErr) {
						logDebug('playTrackHelper', `查询本地代理端口尝试 ${attempt + 1}/5 异常`, portErr)
					}
					await new Promise((r) => setTimeout(r, 80))
				}
			}

			let streamUrl = ''
			if (cachedProxyPort && cachedProxyPort > 0) {
				streamUrl = `http://127.0.0.1:${cachedProxyPort}/local_file?path=${encodeURIComponent(localPath)}`
			} else {
				// 兜底使用 file:/// 路径
				streamUrl = localPath.startsWith('file://') ? localPath : `file:///${localPath.replace(/\\/g, '/')}`
			}

			desktopAudioEngine.setActiveTrack(inputTrack)
			await desktopAudioEngine.loadAndPlay(inputTrack, streamUrl, 0)

			if (requestId === latestPlayRequestId) {
				window.dispatchEvent(
					new CustomEvent('bbplayer:track-updated', { detail: inputTrack }),
				)
				useHistoryStore.getState().addRecord(inputTrack)
			}
		}
	} catch (err: any) {
		logError('playTrackHelper', `播放音轨发生异常: "${inputTrack.title}" (${(inputTrack as any)?.bilibiliMetadata?.bvid || inputTrack.uniqueKey})`, err)
		throw err
	} finally {
		currentLoadingTrackKey = null
		if (typeof window !== 'undefined') {
			window.dispatchEvent(
				new CustomEvent('bbplayer:track-loading', {
					detail: { loading: false, track: inputTrack },
				}),
			)
		}
	}
}