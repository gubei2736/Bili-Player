# BBPlayer 桌面端全量源码修复与 Agent 执行手册

> **致 AI Agent 的执行指令（Agent Execution Instructions）**：
> 本手册包含 BBPlayer 桌面端定位到的 **10 项核心缺陷诊断** 以及 **12 个关联文件的完整修复源码**。
> 请按顺序遍历下方「二、全量文件修改清单与完整代码」中的每一个章节，根据标注的 **目标文件路径**，使用代码块中的完整源码直接覆盖或应用对应修改。

---

## 一、 核心缺陷诊断总览（10 项）

| 编号 | 优先级 | 问题简述 | 涉及文件 | 修复策略 |
| :--- | :---: | :--- | :--- | :--- |
| **#1** | 🔴 严重 | **单曲循环（`repeat_one`）播完后彻底停止，无法自动重播** | `DesktopAudioEngine.ts`<br>`BottomPlayerBar.tsx`<br>`useQueueStore.ts` | 1. `loadAndPlay` 与 `play` 检测 `audio.ended` 时显式将 `currentTime = 0`；<br>2. `BottomPlayerBar` 在 `ended` 回调中若 `nextTrack.uniqueKey === prevUniqueKey`，主动调用 `seek(0)` + `play()`。 |
| **#2** | 🔴 严重 | **桌面悬浮歌词小窗（`DesktopLyricsApp`）永远收不到歌词内容** | `App.tsx`<br>`DesktopLyricsApp.tsx` | 在 `App.tsx` 的 `TRACK_CHANGE` 事件载荷中补齐 `splContent: activeSplContent`，并将 `activeSplContent` 纳入 `useEffect` 依赖项，实现异步歌词拉取及换源后实时同步至桌面小窗。 |
| **#3** | 🔴 严重 | **单曲歌词时间轴微调（Offset）在全屏歌词、底部栏与桌面歌词中不实时生效** | `LyricsSettingsModal.tsx`<br>`BottomPlayerBar.tsx`<br>`ImmersiveLyricsView.tsx`<br>`App.tsx` | 1. 修正变量语义为 `offsetSec`（秒）；<br>2. 在 `LyricsSettingsModal` 调整/重置偏移量时派发 `bbplayer:lyric-offset-change` 事件；<br>3. 在底部栏、全屏歌词、桌面歌词同步中统一监听并累加该偏移秒数。 |
| **#4** | 🟠 中危 | **随机播放（`shuffle`）在软件重启后失效，永远只播第 0 首** | `useQueueStore.ts` | 1. 在 `partialize` 中持久化 `shuffledIndices`；<br>2. 在 `next()` 和 `prev()` 中增加防御性自愈：若 `shuffledIndices.length !== queue.length` 则当场重新生成洗牌序列。 |
| **#5** | 🟠 中危 | **快速连续切歌时网络异步返回乱序，旧歌覆盖新歌播放** | `playTrackHelper.ts` | 引入单调递增请求令牌 `latestPlayRequestId`。在 `getPageList`、`getAudioStream`、`get_stream_proxy_port` 三个异步点后校验 `requestId === latestPlayRequestId`，过期请求立即中止丢弃。 |
| **#6** | 🟠 中危 | **导出音轨弹窗硬编码了开发者个人电脑路径 `C:\Users\szd\Desktop`** | `ExportTrackModal.tsx` | 改用 `@tauri-apps/api/path` 的 `desktopDir()` / `downloadDir()` 与 `join()` 动态解析当前系统用户的真实桌面路径，并使用 `createPortal` 挂载。 |
| **#7** | 🟠 中危 | **应用重启后丢失 `--primary-rgb` 变量导致 Tailwind 主题色回退** | `App.tsx` | 启动恢复装扮时同步调用 `hexToRgbTriple(color)` 设置 `--primary-rgb`，确保 `bg-primary/20` 等透明度类名正常工作。 |
| **#8** | 🟠 中危 | **弹窗未遵循《UI 架构指南》陷阱 1 使用 `createPortal`** | `AddToPlaylistModal.tsx`<br>`ExportTrackModal.tsx` | 使用 `createPortal(..., document.body)` 并将层级提升至 `z-[999]`，彻底避免被父级 `backdrop-filter` 容器截断。 |
| **#9** | 🟡 低危 | **全局快捷键 `Ctrl+Alt+L` 切换穿透时未同步桌面歌词小窗 UI 状态** | `shortcuts.rs`<br>`DesktopLyricsApp.tsx` | 1. Rust 端切换穿透或前端手动点击锁定时，双向同步 `LYRICS_IGNORE_CURSOR` 与 `lyrics-lock-change` 事件；<br>2. 修正悬浮窗 Tooltip 提示为 `Ctrl+Alt+L`。 |
| **#10** | 🟡 低危 | **Rust `http_client.rs` 处理 301/302/303 重定向时未将 POST 转为 GET 且相对路径拼接不严谨** | `http_client.rs` | 1. 遵循 HTTP 规范：当 301/302/303 重定向时自动将 `current_method` 转为 `"GET"` 并清空请求体；<br>2. 使用 `reqwest::Url::join` 标准解析相对 `Location`。 |

---

## 二、 全量文件修改清单与完整代码（共 12 个文件）

---

### 文件 1：`apps/desktop/src/audio/DesktopAudioEngine.ts`
* **修改说明**：
  1. 在 `setupEventListeners` 中补充 `error` 事件转发，并在 `setPositionState` 中使用 `Math.min` 防止 `position > duration` 抛出 DOMException。
  2. 在 `loadAndPlay` 与 `play` 中，当 `this.audio.ended` 为 `true` 时显式重置 `this.audio.currentTime = 0`，修复单曲循环无法重播的问题。
  3. 在 `seek` 中增加 `Math.max(0, timeInSeconds)` 边界保护。

```typescript
import type { Track } from '@bbplayer/shared-core'

export interface AudioEngineContract {
	loadAndPlay(
		track: Track,
		proxyStreamUrl: string,
		loudnessGainDb?: number,
	): Promise<void>
	play(): Promise<void>
	pause(): void
	seek(timeInSeconds: number): void
	setVolume(volume: number): void // 0.0 to 1.0
	setLoudnessNormalization(enabled: boolean): void
	getFrequencyData(buffer: Uint8Array): void
	getCurrentTime(): number
	getDuration(): number
	isPlaying(): boolean
}

export type PlaybackListener = (event: {
	type: 'timeupdate' | 'play' | 'pause' | 'ended' | 'error' | 'loadedmetadata'
	currentTime: number
	duration: number
}) => void

export class DesktopAudioEngine implements AudioEngineContract {
	private audio: HTMLAudioElement
	private audioCtx: AudioContext | null = null
	private sourceNode: MediaElementAudioSourceNode | null = null
	private gainNode: GainNode | null = null
	private compressorNode: DynamicsCompressorNode | null = null
	private analyserNode: AnalyserNode | null = null

	private currentTrack: Track | null = null
	private loudnessNormalizationEnabled = true
	private currentLoudnessGainDb = 0
	private listeners: Set<PlaybackListener> = new Set()

	constructor() {
		this.audio = new Audio()
		this.audio.crossOrigin = 'anonymous'
		try {
			const saved = localStorage.getItem('bbplayer_audio_volume_balance')
			if (saved !== null) {
				this.loudnessNormalizationEnabled = saved === 'true'
			}
		} catch {}
		this.setupEventListeners()
	}

	private initAudioContext(): void {
		if (this.audioCtx) return

		const AudioCtxClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext
		this.audioCtx = new AudioCtxClass()

		// 1. MediaElementAudioSourceNode
		this.sourceNode = this.audioCtx.createMediaElementSource(this.audio)

		// 2. GainNode (响度均衡前置增益)
		this.gainNode = this.audioCtx.createGain()

		// 3. DynamicsCompressorNode (平滑音乐响度统一动态压缩器)
		this.compressorNode = this.audioCtx.createDynamicsCompressor()
		this.compressorNode.threshold.setValueAtTime(-16, this.audioCtx.currentTime)
		this.compressorNode.knee.setValueAtTime(16, this.audioCtx.currentTime)
		this.compressorNode.ratio.setValueAtTime(4.0, this.audioCtx.currentTime)
		this.compressorNode.attack.setValueAtTime(0.005, this.audioCtx.currentTime)
		this.compressorNode.release.setValueAtTime(0.15, this.audioCtx.currentTime)

		// 4. AnalyserNode (FFT 频谱分析)
		this.analyserNode = this.audioCtx.createAnalyser()
		this.analyserNode.fftSize = 256
		this.analyserNode.smoothingTimeConstant = 0.8

		// 5. 链接节点拓扑: Source -> Gain -> Compressor -> Analyser -> Destination
		this.sourceNode.connect(this.gainNode)
		this.gainNode.connect(this.compressorNode)
		this.compressorNode.connect(this.analyserNode)
		this.analyserNode.connect(this.audioCtx.destination)
	}

	private setupEventListeners(): void {
		this.audio.addEventListener('play', () => {
			if ('mediaSession' in navigator) {
				navigator.mediaSession.playbackState = 'playing'
			}
			this.emit({
				type: 'play',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
			})
		})

		this.audio.addEventListener('pause', () => {
			if ('mediaSession' in navigator) {
				navigator.mediaSession.playbackState = 'paused'
			}
			this.emit({
				type: 'pause',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
			})
		})

		this.audio.addEventListener('timeupdate', () => {
			if ('mediaSession' in navigator && !isNaN(this.audio.duration)) {
				try {
					navigator.mediaSession.setPositionState({
						duration: this.audio.duration || 0,
						playbackRate: this.audio.playbackRate || 1,
						position: Math.min(
							this.audio.currentTime || 0,
							this.audio.duration || 0,
						),
					})
				} catch {
					// Position state update fallback
				}
			}
			this.emit({
				type: 'timeupdate',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
			})
		})

		this.audio.addEventListener('ended', () => {
			this.emit({
				type: 'ended',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
			})
		})

		this.audio.addEventListener('loadedmetadata', () => {
			this.emit({
				type: 'loadedmetadata',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
			})
		})

		this.audio.addEventListener('error', () => {
			this.emit({
				type: 'error',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
			})
		})
	}

	private updateMediaSession(track: Track): void {
		if ('mediaSession' in navigator) {
			const artwork = track.coverUrl
				? [
						{ src: track.coverUrl, sizes: '96x96', type: 'image/jpeg' },
						{ src: track.coverUrl, sizes: '256x256', type: 'image/jpeg' },
						{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' },
					]
				: []

			navigator.mediaSession.metadata = new MediaMetadata({
				title: track.title,
				artist: track.artist?.name || '未知歌手',
				album: 'BBPlayer',
				artwork,
			})
		}
	}

	public setupMediaSessionHandlers(handlers: {
		onPlay?: () => void
		onPause?: () => void
		onNext?: () => void
		onPrev?: () => void
		onSeek?: (time: number) => void
	}): void {
		if (!('mediaSession' in navigator)) return
		if (handlers.onPlay)
			navigator.mediaSession.setActionHandler('play', handlers.onPlay)
		if (handlers.onPause)
			navigator.mediaSession.setActionHandler('pause', handlers.onPause)
		if (handlers.onNext)
			navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext)
		if (handlers.onPrev)
			navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev)
		if (handlers.onSeek) {
			navigator.mediaSession.setActionHandler('seekto', (details) => {
				if (details.seekTime !== undefined && details.seekTime !== null) {
					handlers.onSeek!(details.seekTime)
				}
			})
		}
	}

	private emit(event: Parameters<PlaybackListener>[0]): void {
		this.listeners.forEach((listener) => listener(event))
	}

	public subscribe(listener: PlaybackListener): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	public async loadAndPlay(
		track: Track,
		proxyStreamUrl: string,
		loudnessGainDb = 0,
	): Promise<void> {
		this.initAudioContext()
		if (this.audioCtx?.state === 'suspended') {
			await this.audioCtx.resume()
		}

		const isSameTrack = this.currentTrack?.uniqueKey === track.uniqueKey
		const isSameSrc = this.audio.src === proxyStreamUrl

		this.currentTrack = track
		this.currentLoudnessGainDb = loudnessGainDb

		// 只有在音频源真正改变时才重新为 audio.src 赋值，防止重复从 0 秒重播
		if (!isSameTrack || !isSameSrc) {
			this.audio.src = proxyStreamUrl
		} else if (this.audio.ended) {
			// 如果是单曲循环播放完毕后再次触发同一音频源，显式归零进度
			this.audio.currentTime = 0
		}

		this.applyLoudnessGain()
		this.updateMediaSession(track)

		await this.audio.play()
	}

	private applyLoudnessGain(): void {
		if (!this.gainNode || !this.audioCtx) return

		let linearGain = 1.0
		if (this.loudnessNormalizationEnabled) {
			if (this.currentLoudnessGainDb !== 0) {
				// 限制增益在安全范围 [-9dB, +9dB] 之间，防止过大失真或过低音量
				const clampedDb = Math.max(-9, Math.min(9, this.currentLoudnessGainDb))
				linearGain = Math.pow(10, clampedDb / 20)
			}
			// 启用平滑音乐动态压限
			if (this.compressorNode) {
				this.compressorNode.threshold.setTargetAtTime(-16, this.audioCtx.currentTime, 0.05)
				this.compressorNode.knee.setTargetAtTime(16, this.audioCtx.currentTime, 0.05)
				this.compressorNode.ratio.setTargetAtTime(4.0, this.audioCtx.currentTime, 0.05)
			}
		} else {
			// 关闭音量平衡时，压缩器旁通直通
			if (this.compressorNode) {
				this.compressorNode.threshold.setTargetAtTime(0, this.audioCtx.currentTime, 0.05)
				this.compressorNode.ratio.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.05)
			}
		}

		// 80ms 平滑过渡，杜绝音量骤变产生的爆音
		this.gainNode.gain.setTargetAtTime(
			linearGain,
			this.audioCtx.currentTime,
			0.08,
		)
	}

	public async play(): Promise<void> {
		if (this.audioCtx?.state === 'suspended') {
			await this.audioCtx.resume()
		}
		if (this.audio.ended) {
			this.audio.currentTime = 0
		}
		await this.audio.play()
	}

	public pause(): void {
		this.audio.pause()
	}

	public seek(timeInSeconds: number): void {
		if (isFinite(timeInSeconds)) {
			this.audio.currentTime = Math.max(0, timeInSeconds)
		}
	}

	public setVolume(volume: number): void {
		this.audio.volume = Math.max(0, Math.min(1, volume))
	}

	public setLoudnessNormalization(enabled: boolean): void {
		this.loudnessNormalizationEnabled = enabled
		try {
			localStorage.setItem('bbplayer_audio_volume_balance', String(enabled))
		} catch {}
		this.applyLoudnessGain()
	}

	public isLoudnessNormalizationEnabled(): boolean {
		return this.loudnessNormalizationEnabled
	}

	public getFrequencyData(buffer: Uint8Array): void {
		if (this.analyserNode) {
			this.analyserNode.getByteFrequencyData(buffer)
		} else {
			buffer.fill(0)
		}
	}

	public getCurrentTime(): number {
		return this.audio.currentTime
	}

	public getDuration(): number {
		return this.audio.duration || 0
	}

	public isPlaying(): boolean {
		return !this.audio.paused && !this.audio.ended
	}

	public getCurrentTrack(): Track | null {
		return this.currentTrack
	}
}

export const desktopAudioEngine = new DesktopAudioEngine()
```

---

### 文件 2：`apps/desktop/src/audio/playTrackHelper.ts`
* **修改说明**：
  1. 引入 `latestPlayRequestId` 递增序号锁，解决用户在网络请求尚未返回时快速点击另一首歌导致的乱序覆盖播放问题。
  2. 支持可选参数 `forceReplay = false`。

```typescript
import { bilibiliApi, useHistoryStore, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { desktopAudioEngine } from './DesktopAudioEngine'
import { getAudioQualityPreference } from './audioSettings'
import { invoke } from '@tauri-apps/api/core'

let currentLoadingTrackKey: string | null = null
let latestPlayRequestId = 0

export async function playTrackWithProxy(track: Track, forceReplay = false): Promise<void> {
	// 1. 防重保护：如果相同曲目已在加载中或正在播放，直接返回，避免并发打断与二次重播从 0 秒开始
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
```

---

### 文件 3：`packages/shared-core/src/stores/useQueueStore.ts`
* **修改说明**：
  1. 在 `partialize` 中增加 `shuffledIndices: state.shuffledIndices`。
  2. 在 `next()` 和 `prev()` 的 `shuffle` 分支中增加 `if (shuffledIndices.length !== queue.length)` 自愈逻辑，彻底修复重启软件后随机模式退化为只播第 0 首的 Bug。

```typescript
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Track } from '../types/media'
import { getDefaultStateStorage } from './storage'

export type PlayMode = 'sequential' | 'shuffle' | 'repeat_one' | 'repeat_all'

export interface QueueState {
	queue: Track[]
	currentIndex: number
	playMode: PlayMode
	shuffledIndices: number[]

	setQueue: (tracks: Track[], startIndex?: number) => void
	addTrack: (track: Track, playNext?: boolean) => void
	removeTrack: (index: number) => void
	clearQueue: () => void
	setCurrentIndex: (index: number) => void
	next: () => Track | null
	prev: () => Track | null
	setPlayMode: (mode: PlayMode) => void
	getCurrentTrack: () => Track | null
}

function generateShuffleIndices(length: number): number[] {
	const indices = Array.from({ length }, (_, i) => i)
	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = indices[i]!
		indices[i] = indices[j]!
		indices[j] = temp
	}
	return indices
}

export const useQueueStore = create<QueueState>()(
	persist(
		(set, get) => ({
			queue: [],
			currentIndex: -1,
			playMode: 'sequential',
			shuffledIndices: [],

			setQueue: (tracks, startIndex = 0) => {
				const validIndex =
					tracks.length > 0
						? Math.max(0, Math.min(startIndex, tracks.length - 1))
						: -1

				const shuffled =
					get().playMode === 'shuffle'
						? generateShuffleIndices(tracks.length)
						: []

				set({
					queue: tracks,
					currentIndex: validIndex,
					shuffledIndices: shuffled,
				})
			},

			addTrack: (track, playNext = false) => {
				const { queue, currentIndex } = get()
				const existingIndex = queue.findIndex(
					(t) => t.uniqueKey === track.uniqueKey,
				)

				if (existingIndex !== -1) {
					// Already in queue
					if (playNext && existingIndex !== currentIndex) {
						const newQueue = [...queue]
						const [removed] = newQueue.splice(existingIndex, 1)
						if (removed) {
							const insertPos =
								currentIndex >= 0 ? currentIndex + 1 : newQueue.length
							newQueue.splice(insertPos, 0, removed)
							set({ queue: newQueue })
						}
					}
					return
				}

				const newQueue = [...queue]
				if (playNext && currentIndex >= 0) {
					newQueue.splice(currentIndex + 1, 0, track)
				} else {
					newQueue.push(track)
				}

				set({
					queue: newQueue,
					currentIndex: currentIndex === -1 ? 0 : currentIndex,
					shuffledIndices:
						get().playMode === 'shuffle'
							? generateShuffleIndices(newQueue.length)
							: [],
				})
			},

			removeTrack: (index) => {
				const { queue, currentIndex } = get()
				if (index < 0 || index >= queue.length) return

				const newQueue = queue.filter((_, i) => i !== index)
				let newIndex = currentIndex

				if (index < currentIndex) {
					newIndex--
				} else if (index === currentIndex) {
					newIndex = newQueue.length > 0 ? Math.min(currentIndex, newQueue.length - 1) : -1
				}

				set({
					queue: newQueue,
					currentIndex: newIndex,
					shuffledIndices:
						get().playMode === 'shuffle'
							? generateShuffleIndices(newQueue.length)
							: [],
				})
			},

			clearQueue: () => {
				set({
					queue: [],
					currentIndex: -1,
					shuffledIndices: [],
				})
			},

			setCurrentIndex: (index) => {
				const { queue } = get()
				if (index >= 0 && index < queue.length) {
					set({ currentIndex: index })
				}
			},

			next: () => {
				const { queue, currentIndex, playMode } = get()
				let { shuffledIndices } = get()
				if (queue.length === 0) return null

				if (playMode === 'repeat_one') {
					const validIdx =
						currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0
					return queue[validIdx] ?? null
				}

				if (playMode === 'shuffle') {
					if (shuffledIndices.length !== queue.length) {
						shuffledIndices = generateShuffleIndices(queue.length)
					}
					const currShufflePos = shuffledIndices.indexOf(currentIndex)
					const nextShufflePos = (currShufflePos + 1) % shuffledIndices.length
					const nextIdx = shuffledIndices[nextShufflePos] ?? 0
					set({ currentIndex: nextIdx, shuffledIndices })
					return queue[nextIdx] ?? null
				}

				const nextIdx = currentIndex + 1
				if (nextIdx >= queue.length) {
					if (playMode === 'repeat_all') {
						set({ currentIndex: 0 })
						return queue[0] ?? null
					}
					return null
				}

				set({ currentIndex: nextIdx })
				return queue[nextIdx] ?? null
			},

			prev: () => {
				const { queue, currentIndex, playMode } = get()
				let { shuffledIndices } = get()
				if (queue.length === 0) return null

				if (playMode === 'repeat_one') {
					const validIdx =
						currentIndex >= 0 && currentIndex < queue.length ? currentIndex : 0
					return queue[validIdx] ?? null
				}

				if (playMode === 'shuffle') {
					if (shuffledIndices.length !== queue.length) {
						shuffledIndices = generateShuffleIndices(queue.length)
					}
					const currShufflePos = shuffledIndices.indexOf(currentIndex)
					const prevShufflePos =
						(currShufflePos - 1 + shuffledIndices.length) %
						shuffledIndices.length
					const prevIdx = shuffledIndices[prevShufflePos] ?? 0
					set({ currentIndex: prevIdx, shuffledIndices })
					return queue[prevIdx] ?? null
				}

				const prevIdx = currentIndex - 1
				if (prevIdx < 0) {
					if (playMode === 'repeat_all') {
						const lastIdx = queue.length - 1
						set({ currentIndex: lastIdx })
						return queue[lastIdx] ?? null
					}
					return null
				}

				set({ currentIndex: prevIdx })
				return queue[prevIdx] ?? null
			},

			setPlayMode: (mode) => {
				const { queue } = get()
				const shuffled =
					mode === 'shuffle' ? generateShuffleIndices(queue.length) : []
				set({ playMode: mode, shuffledIndices: shuffled })
			},

			getCurrentTrack: () => {
				const { queue, currentIndex } = get()
				if (currentIndex >= 0 && currentIndex < queue.length) {
					return queue[currentIndex] ?? null
				}
				return null
			},
		}),
		{
			name: 'bbplayer_queue_store',
			storage: createJSONStorage(() => getDefaultStateStorage()),
			partialize: (state) => ({
				queue: state.queue,
				currentIndex: state.currentIndex,
				playMode: state.playMode,
				shuffledIndices: state.shuffledIndices,
			}),
		},
	),
)
```

---

### 文件 4：`apps/desktop/src/App.tsx`
* **修改说明**：
  1. 启动恢复主题色时增加 `--primary-rgb` 变量注入。
  2. 在 `TRACK_CHANGE` IPC 消息中携带 `splContent: activeSplContent || undefined`，修复桌面歌词无歌词显示的问题。
  3. 在 `STATE_SYNC` IPC 消息中叠加 `getStoredLyricOffset(activeTrack.uniqueKey)`，使单曲歌词偏移同步作用于桌面悬浮歌词。

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
	Music,
	Play,
	TrendingUp,
	Sparkles,
	CheckCircle2,
	Download,
} from 'lucide-react'
import { MainLayout } from './components/layout/MainLayout'
import type { NavTab } from './components/layout/Sidebar'
import { LoginModal } from './components/modals/LoginModal'
import { PlaylistImportModal } from './components/modals/PlaylistImportModal'
import { CreatePlaylistModal } from './components/modals/CreatePlaylistModal'
import { ExportTrackModal } from './components/modals/ExportTrackModal'
import { ImmersiveLyricsView } from './components/player/ImmersiveLyricsView'
import { lyricService, getStoredLyricOffset } from './services/lyricService'
import { SkinStoreView } from './components/views/SkinStoreView'
import { HistoryHeatmapView } from './components/views/HistoryHeatmapView'
import { SearchView } from './components/views/SearchView'
import { ShortcutsSettingsView } from './components/views/ShortcutsSettingsView'
import { FavoritesView } from './components/views/FavoritesView'
import { CollectionsView } from './components/views/CollectionsView'
import { LibraryView } from './components/views/LibraryView'
import { AudioQualitySettingsCard } from './components/views/AudioQualitySettingsCard'
import { initDesktopDatabase } from './db/desktopDb'
import {
	useQueueStore,
	useSkinStore,
	useAuthStore,
	usePlaylistStore,
	bilibiliApi,
	type Track,
	type Artist,
} from '@bbplayer/shared-core'
import { desktopAudioEngine } from './audio/DesktopAudioEngine'
import { playTrackWithProxy } from './audio/playTrackHelper'
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'

const dummyArtist = (id: number, name: string): Artist => ({
	id,
	name,
	source: 'bilibili',
	createdAt: new Date(),
	updatedAt: new Date(),
})

function hexToRgbTriple(hex: string): string {
	let c = hex.replace('#', '')
	if (c.length === 3) {
		c = c
			.split('')
			.map((x) => x + x)
			.join('')
	}
	const num = parseInt(c, 16)
	if (Number.isNaN(num)) return '0 174 236'
	const r = (num >> 16) & 255
	const g = (num >> 8) & 255
	const b = num & 255
	return `${r} ${g} ${b}`
}

export const App: React.FC = () => {
	const [loginModalOpen, setLoginModalOpen] = useState(false)
	const [playlistImportOpen, setPlaylistImportOpen] = useState(false)
	const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false)
	const [activeSplContent, setActiveSplContent] = useState<string>('')
	const [exportModalTrack, setExportModalTrack] = useState<Track | null>(null)
	const [fullscreenLyricsOpen, setFullscreenLyricsOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<NavTab>('explore')
	const [searchQuery, setSearchQuery] = useState('')
	const [dbReady, setDbReady] = useState(false)
	const [featuredTracks, setFeaturedTracks] = useState<Track[]>([
		{
			id: 1,
			uniqueKey: 'bilibili_BV1GJ411x7h7_0',
			title: '【官方 MV】Never Gonna Give You Up - Rick Astley',
			artist: dummyArtist(101, '索尼音乐中国'),
			coverUrl: 'https://i1.hdslb.com/bfs/archive/5242750857121e05146d5d5b13a47a2a6dd36e98.jpg',
			duration: 213,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1GJ411x7h7',
				cid: 137649199,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 2,
			uniqueKey: 'bilibili_BV1EYwxePEHJ_0',
			title: '《原神》特别EP - 「幽谷舟咏」',
			artist: dummyArtist(102, '原神'),
			coverUrl: 'https://i2.hdslb.com/bfs/archive/ff495d93efb4fd3921ed5f216601d7455598c074.jpg',
			duration: 134,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1EYwxePEHJ',
				cid: 27983873703,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 3,
			uniqueKey: 'bilibili_BV1Sg411w7T9_0',
			title: '【官方MV】宇多田光 - 《One Last Kiss》',
			artist: dummyArtist(103, '宇多田光'),
			coverUrl: 'https://i1.hdslb.com/bfs/archive/0b8cae3ed099b9697d35d184c7fd3cd9c34f119f.jpg',
			duration: 260,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1Sg411w7T9',
				cid: 464871141,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
		{
			id: 4,
			uniqueKey: 'bilibili_BV1eg411U7h3_0',
			title: '【混沌武士】四季ノ唄 -Jazz Ver.-【Himawari翻唱】',
			artist: dummyArtist(104, '-Himawari-'),
			coverUrl: 'https://i2.hdslb.com/bfs/archive/e4e451d42aebbe1fb0cbe978eb7fa87d528a451a.jpg',
			duration: 170,
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
			bilibiliMetadata: {
				bvid: 'BV1eg411U7h3',
				cid: 832811547,
				isMultiPage: false,
				videoIsValid: true,
			},
		},
	])

	const { setQueue, next, prev, getCurrentTrack } = useQueueStore()
	const currentTrack = getCurrentTrack()
	const { isLoggedIn, userInfo } = useAuthStore()
	const { syncRemotePlaylists } = usePlaylistStore()

	// Auto sync remote playlists and collections when logged in
	useEffect(() => {
		if (isLoggedIn && userInfo?.mid) {
			syncRemotePlaylists(userInfo.mid).catch((err) => {
				console.warn('Auto sync remote playlists failed:', err)
			})
		}
	}, [isLoggedIn, userInfo?.mid, syncRemotePlaylists])

	// Auto fetch lyrics dynamically for current track
	useEffect(() => {
		let cancelled = false
		if (currentTrack) {
			lyricService.fetchLyricForTrack(currentTrack).then((res) => {
				if (!cancelled) {
					setActiveSplContent(res?.splContent || '')
				}
			})
		} else {
			setActiveSplContent('')
		}
		return () => {
			cancelled = true
		}
	}, [currentTrack?.uniqueKey])

	useEffect(() => {
		const handleCustom = (e: any) => {
			if (e.detail?.trackKey === currentTrack?.uniqueKey) {
				setActiveSplContent(e.detail.splContent)
			}
		}
		window.addEventListener('bbplayer:custom-lyric-change', handleCustom)
		return () => {
			window.removeEventListener('bbplayer:custom-lyric-change', handleCustom)
		}
	}, [currentTrack?.uniqueKey])

	// 1. Initialize DB
	useEffect(() => {
		initDesktopDatabase()
			.then(() => setDbReady(true))
			.catch((e) => console.warn('Database initialization note:', e))
	}, [])

	// 2. Initialize active theme skin colors (including --primary-rgb for Tailwind alpha support)
	useEffect(() => {
		const skin = useSkinStore.getState().activeSkinSuit
		const color = skin?.suit_items?.skin?.[0]?.properties?.color
		if (color) {
			const rgb = hexToRgbTriple(color)
			document.documentElement.style.setProperty('--primary-rgb', rgb)
			document.documentElement.style.setProperty('--primary', color)
			document.documentElement.style.setProperty('--bili-theme-primary', color)
			document.documentElement.style.setProperty('--ring', color)
		}
	}, [])

	// 2.1 Fetch online trending music dynamically on mount
	useEffect(() => {
		const loadTracks = async () => {
			try {
				const res = await bilibiliApi.searchVideos({ keyword: '热门音乐', page: 1 })
				if (res.isOk() && res.value.result && res.value.result.length > 0) {
					const tracks: Track[] = res.value.result.slice(0, 8).map((item, idx) => {
						let cover = item.pic || ''
						if (cover.startsWith('//')) cover = 'https:' + cover
						return {
							id: idx + 100,
							uniqueKey: `bilibili_${item.bvid}_0`,
							title: item.title.replace(/<[^>]*>?/gm, ''),
							artist: {
								id: item.mid || idx + 100,
								name: item.author || '哔哩哔哩音乐人',
								source: 'bilibili',
								createdAt: new Date(),
								updatedAt: new Date(),
							},
							coverUrl: cover,
							duration: 240,
							source: 'bilibili',
							createdAt: new Date(),
							updatedAt: new Date(),
							bilibiliMetadata: {
								bvid: item.bvid,
								cid: null,
								isMultiPage: false,
								videoIsValid: true,
							},
						}
					})
					setFeaturedTracks(tracks)
				}
			} catch {}
		}
		loadTracks()
	}, [])

	// 2.2 Sync saved shortcuts to Rust on startup & auto-migrate Alt+Shift to Ctrl+Alt
	useEffect(() => {
		try {
			const saved = localStorage.getItem('bbplayer_shortcuts')
			if (saved) {
				let configs = JSON.parse(saved)
				let upgraded = false
				if (Array.isArray(configs)) {
					configs = configs.map((c: any) => {
						if (typeof c.key === 'string' && c.key.includes('Alt+Shift')) {
							upgraded = true
							return { ...c, key: c.key.replace(/Alt\+Shift/g, 'Ctrl+Alt') }
						}
						return c
					})
					if (upgraded) {
						localStorage.setItem('bbplayer_shortcuts', JSON.stringify(configs))
					}
					if (configs.length > 0) {
						invoke('update_shortcuts', { configs }).catch(() => {})
					}
				}
			}
		} catch {}
	}, [])

	const handlePlayTrack = useCallback(
		async (track: Track, index: number) => {
			setQueue(featuredTracks, index)
			try {
				await playTrackWithProxy(track)
			} catch (err) {
				console.error('Failed to play track with proxy:', err)
			}
		},
		[featuredTracks, setQueue],
	)

	const lastShortcutTriggerTimeRef = useRef<number>(0)

	const handleGlobalShortcutAction = useCallback(
		(action: string) => {
			const now = Date.now()
			if (now - lastShortcutTriggerTimeRef.current < 150) return
			lastShortcutTriggerTimeRef.current = now

			if (action === 'play_pause') {
				if (desktopAudioEngine.isPlaying()) {
					desktopAudioEngine.pause()
				} else {
					if (!currentTrack && featuredTracks.length > 0) {
						handlePlayTrack(featuredTracks[0]!, 0)
					} else {
						desktopAudioEngine.play()
					}
				}
			} else if (action === 'prev_track') {
				const prevTrack = prev()
				if (prevTrack) {
					playTrackWithProxy(prevTrack).catch(() => {})
				}
			} else if (action === 'next_track') {
				const nextTrack = next()
				if (nextTrack) {
					playTrackWithProxy(nextTrack).catch(() => {})
				}
			}
		},
		[next, prev, currentTrack, featuredTracks, handlePlayTrack],
	)

	// Keep a persistent ref to handleGlobalShortcutAction so listener never gets unmounted
	const handleGlobalShortcutActionRef = useRef<(action: string) => void>(() => {})
	useEffect(() => {
		handleGlobalShortcutActionRef.current = handleGlobalShortcutAction
	})

	// 3. Global Shortcuts IPC Event Listener & Eval Hook (Permanent mount)
	useEffect(() => {
		;(window as any).__triggerGlobalShortcut = (action: string) => {
			handleGlobalShortcutActionRef.current(action)
		}

		let unlistenFn: (() => void) | undefined
		listen<string>('global-shortcut-event', async (event) => {
			handleGlobalShortcutActionRef.current(event.payload)
		})
			.then((fn) => {
				unlistenFn = fn
			})
			.catch(() => {})

		return () => {
			delete (window as any).__triggerGlobalShortcut
			if (unlistenFn) unlistenFn()
		}
	}, [])

	// 4. In-App Single-Key & Global Shortcuts Handling
	useEffect(() => {
		const matchesShortcut = (e: KeyboardEvent, shortcutStr?: string): boolean => {
			if (!shortcutStr) return false
			const parts = shortcutStr.split('+').map((p) => p.trim())
			const mainKey = parts[parts.length - 1]!.toLowerCase()
			const hasCtrl = parts.some((p) => p.toLowerCase() === 'ctrl' || p.toLowerCase() === 'control')
			const hasAlt = parts.some((p) => p.toLowerCase() === 'alt')
			const hasShift = parts.some((p) => p.toLowerCase() === 'shift')
			const hasMeta = parts.some((p) => ['super', 'meta', 'win'].includes(p.toLowerCase()))

			if (e.ctrlKey !== hasCtrl) return false
			if (e.altKey !== hasAlt) return false
			if (e.shiftKey !== hasShift) return false
			if (e.metaKey !== hasMeta) return false

			const eventKey = e.key.toLowerCase()
			const eventCode = e.code.toLowerCase()

			if (mainKey === 'space' && (eventCode === 'space' || eventKey === ' ')) return true
			if (
				(mainKey === 'left' || mainKey === 'arrowleft') &&
				(eventCode === 'arrowleft' || eventKey === 'arrowleft')
			)
				return true
			if (
				(mainKey === 'right' || mainKey === 'arrowright') &&
				(eventCode === 'arrowright' || eventKey === 'arrowright')
			)
				return true
			if (
				(mainKey === 'up' || mainKey === 'arrowup') &&
				(eventCode === 'arrowup' || eventKey === 'arrowup')
			)
				return true
			if (
				(mainKey === 'down' || mainKey === 'arrowdown') &&
				(eventCode === 'arrowdown' || eventKey === 'arrowdown')
			)
				return true

			return (
				eventKey === mainKey ||
				eventCode === `key${mainKey}` ||
				eventCode === mainKey ||
				eventKey.toUpperCase() === mainKey.toUpperCase()
			)
		}

		const handleLocalKeyDown = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target as HTMLElement)?.isContentEditable
			) {
				return
			}

			// 1. Space 单键独立控制播放/暂停
			if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
				e.preventDefault()
				handleGlobalShortcutActionRef.current('play_pause')
				return
			}

			let shortcutsConfig = [
				{ id: 'play_pause', key: 'Ctrl+Alt+Space' },
				{ id: 'prev_track', key: 'Ctrl+Alt+ArrowLeft' },
				{ id: 'next_track', key: 'Ctrl+Alt+ArrowRight' },
			]
			try {
				const saved = localStorage.getItem('bbplayer_shortcuts')
				if (saved) shortcutsConfig = JSON.parse(saved)
			} catch {}

			const playPauseKey = shortcutsConfig.find((s) => s.id === 'play_pause')?.key
			const prevKey = shortcutsConfig.find((s) => s.id === 'prev_track')?.key
			const nextKey = shortcutsConfig.find((s) => s.id === 'next_track')?.key

			if (matchesShortcut(e, playPauseKey)) {
				e.preventDefault()
				handleGlobalShortcutActionRef.current('play_pause')
			} else if (matchesShortcut(e, prevKey)) {
				e.preventDefault()
				handleGlobalShortcutActionRef.current('prev_track')
			} else if (matchesShortcut(e, nextKey)) {
				e.preventDefault()
				handleGlobalShortcutActionRef.current('next_track')
			}
		}

		window.addEventListener('keydown', handleLocalKeyDown)
		return () => window.removeEventListener('keydown', handleLocalKeyDown)
	}, [])

	// 5. Throttled IPC Lyrics Synchronization to Desktop Floating Lyrics Window (with Offset applied)
	const currentTrackRef = useRef<Track | null>(currentTrack)
	useEffect(() => {
		currentTrackRef.current = currentTrack
	}, [currentTrack])

	useEffect(() => {
		let lastSentMs = 0
		let lastPlayState = false
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			const now = Date.now()
			const isPlaying = desktopAudioEngine.isPlaying()
			if (isPlaying !== lastPlayState || now - lastSentMs > 200) {
				lastSentMs = now
				lastPlayState = isPlaying
				const activeTrack = currentTrackRef.current
				const offsetSec = activeTrack ? getStoredLyricOffset(activeTrack.uniqueKey) : 0
				emit('lyrics-sync', {
					type: 'STATE_SYNC',
					isPlaying,
					currentTimeMs: Math.max(0, (event.currentTime + offsetSec) * 1000),
					timestamp: now,
				}).catch(() => {})
			}
		})
		return unsubscribe
	}, [])

	// Sync Track Info AND SPL Lyrics content to Desktop Floating Lyrics Window
	useEffect(() => {
		if (currentTrack) {
			emit('lyrics-sync', {
				type: 'TRACK_CHANGE',
				title: currentTrack.title,
				artist: currentTrack.artist?.name || '未知歌手',
				durationMs: (currentTrack.duration || 0) * 1000,
				splContent: activeSplContent || undefined,
			}).catch(() => {})
		}
	}, [currentTrack, activeSplContent])

	const handleSearch = (query: string) => {
		if (!query.trim()) return
		setSearchQuery(query)
		setActiveTab('search')
	}

	const handleToggleLyricsWindow = async () => {
		try {
			await invoke('toggle_lyrics_window')
		} catch (err) {
			console.warn('Lyrics window invoke fallback:', err)
		}
	}

	return (
		<>
			<MainLayout
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				onSearch={handleSearch}
				onToggleLyricsWindow={handleToggleLyricsWindow}
				onToggleFullscreenLyrics={() =>
					setFullscreenLyricsOpen(!fullscreenLyricsOpen)
				}
				onOpenLoginModal={() => setLoginModalOpen(true)}
			>
				{(tab) => (
					<div className="h-full flex flex-col space-y-6">
						{tab === 'explore' && (
							<div className="space-y-6">
								{/* Banner Hero */}
								<div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-pink-500/20 via-sky-500/20 to-indigo-500/20 p-8 border border-white/10 backdrop-blur-md">
									<div className="max-w-xl space-y-2">
										<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[11px] font-medium text-sky-300">
											<Sparkles className="w-3.5 h-3.5" />
											<span>Tauri v2 跨平台原生架构</span>
										</div>
										<h1 className="text-2xl font-bold tracking-tight text-white">
											让 B 站成为你的全能高保真音乐库
										</h1>
										<p className="text-xs text-muted-foreground leading-relaxed">
											原生 Mica 毛玻璃材质、独立穿透桌面歌词、Web Audio 响度均衡防爆音、本地流媒体无损缓存与纯 Rust 格式导出。
										</p>
									</div>
								</div>

								{/* Trending / Recommended Tracks */}
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
											<TrendingUp className="w-4 h-4 text-sky-400" />
											<span>今日精选推荐</span>
										</h2>
										<span className="text-xs text-muted-foreground">
											共 {featuredTracks.length} 首音乐
										</span>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
										{featuredTracks.map((track, idx) => (
											<div
												key={track.id}
												className="group relative rounded-xl p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
											>
												<div
													className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 bg-gradient-to-tr from-sky-950/60 to-purple-950/60 flex items-center justify-center"
													onClick={() => handlePlayTrack(track, idx)}
												>
													<Music className="w-8 h-8 text-white/20 absolute" />
													<img
														src={
															track.coverUrl ||
															'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
														}
														alt={track.title}
														referrerPolicy="no-referrer"
														className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 relative z-0"
														onError={(e) => {
															;(e.currentTarget as HTMLImageElement).style.opacity = '0'
														}}
													/>
													<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
														<div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
															<Play className="w-5 h-5 fill-current ml-0.5" />
														</div>
													</div>
												</div>
												<div className="flex items-center justify-between">
													<div
														className="overflow-hidden flex-1 mr-2"
														onClick={() => handlePlayTrack(track, idx)}
													>
														<p className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
															{track.title}
														</p>
														<p className="text-[11px] text-muted-foreground truncate">
															{track.artist?.name || '未知歌手'}
														</p>
													</div>
													<button
														onClick={(e) => {
															e.stopPropagation()
															setExportModalTrack(track)
														}}
														title="导出为 .m4a"
														className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
													>
														<Download className="w-3.5 h-3.5" />
													</button>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						)}

						{tab === 'search' && (
							<SearchView
								keyword={searchQuery}
								onExportTrack={setExportModalTrack}
							/>
						)}

						{tab === 'library' && (
							<LibraryView
								onOpenImport={() => setPlaylistImportOpen(true)}
								onOpenCreate={() => setCreatePlaylistOpen(true)}
								onExportTrack={setExportModalTrack}
							/>
						)}

						{tab === 'favorites' && (
							<FavoritesView
								onExportTrack={setExportModalTrack}
								onOpenLoginModal={() => setLoginModalOpen(true)}
							/>
						)}

						{tab === 'collections' && (
							<CollectionsView
								onExportTrack={setExportModalTrack}
								onOpenLoginModal={() => setLoginModalOpen(true)}
							/>
						)}

						{tab === 'history' && <HistoryHeatmapView />}

						{tab === 'skins' && <SkinStoreView />}

						{tab === 'settings' && (
							<div className="space-y-4 max-w-xl">
								<h2 className="text-base font-bold text-foreground">
									偏好设置
								</h2>

								{/* Audio Quality Preferences */}
								<AudioQualitySettingsCard />

								<div className="space-y-3 rounded-xl bg-white/5 p-4 border border-white/5 text-xs">
									<div className="flex items-center justify-between">
										<div>
											<p className="font-semibold text-foreground">
												Web Audio 响度均衡
											</p>
											<p className="text-[11px] text-muted-foreground">
												自动根据 B 站音轨响度差值平滑应用 GainNode 动态增益
											</p>
										</div>
										<CheckCircle2 className="w-4 h-4 text-emerald-400" />
									</div>
									<div className="h-px bg-white/5" />
									<div className="flex items-center justify-between">
										<div>
											<p className="font-semibold text-foreground">
												SQLite 数据库状态
											</p>
											<p className="text-[11px] text-muted-foreground">
												{dbReady ? '已连接并完成迁移' : '就绪'}
											</p>
										</div>
										<CheckCircle2 className="w-4 h-4 text-emerald-400" />
									</div>
								</div>

								{/* Customizable Shortcuts Settings */}
								<div className="pt-2">
									<ShortcutsSettingsView />
								</div>
							</div>
						)}
					</div>
				)}
			</MainLayout>

			<LoginModal
				isOpen={loginModalOpen}
				onClose={() => setLoginModalOpen(false)}
			/>

			<PlaylistImportModal
				isOpen={playlistImportOpen}
				onClose={() => setPlaylistImportOpen(false)}
			/>

			<CreatePlaylistModal
				isOpen={createPlaylistOpen}
				onClose={() => setCreatePlaylistOpen(false)}
				onSuccess={() => {
					if (userInfo?.mid) {
						usePlaylistStore.getState().syncRemotePlaylists(userInfo.mid)
					}
				}}
			/>

			<ExportTrackModal
				isOpen={exportModalTrack !== null}
				onClose={() => setExportModalTrack(null)}
				track={exportModalTrack}
			/>

			<ImmersiveLyricsView
				isOpen={fullscreenLyricsOpen}
				onClose={() => setFullscreenLyricsOpen(false)}
				track={currentTrack}
				splContent={activeSplContent}
			/>
		</>
	)
}

export default App
```

---

### 文件 5：`apps/desktop/src/components/layout/BottomPlayerBar.tsx`
* **修改说明**：
  1. 在 `ended` 监听器中判断 `nextTrack.uniqueKey === prevUniqueKey`，若是单曲循环则直接触发 `desktopAudioEngine.seek(0)` 和 `desktopAudioEngine.play()`。
  2. 监听 `bbplayer:lyric-offset-change` 事件实时更新 `lyricOffsetSec` 状态。
  3. 在 `onLyricsUpdated` 回调中同时派发 `bbplayer:custom-lyric-change` 全局事件，确保全屏歌词与桌面歌词同步更新。

```tsx
import React, { useState, useEffect, useMemo } from 'react'
import {
	Play,
	Pause,
	SkipBack,
	SkipForward,
	Repeat,
	Repeat1,
	Shuffle,
	Volume2,
	VolumeX,
	Maximize2,
	Sliders,
	FileText,
} from 'lucide-react'
import { useQueueStore, useSkinStore, type BilibiliTrack } from '@bbplayer/shared-core'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import { getQualityBadgeInfo } from '../../audio/audioSettings'
import { WavySlider } from '../player/WavySlider'
import { parseSpl } from '@bbplayer/splash'
import {
	lyricService,
	getStoredLyricOffset,
} from '../../services/lyricService'
import { LyricsSettingsModal } from '../modals/LyricsSettingsModal'

export interface BottomPlayerBarProps {
	onToggleFullscreenLyrics?: () => void
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
	onToggleFullscreenLyrics,
}) => {
	const {
		playMode,
		setPlayMode,
		next,
		prev,
		getCurrentTrack,
	} = useQueueStore()

	const { themeColors } = useSkinStore()

	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [volume, setVolume] = useState(0.8)
	const [isMuted, setIsMuted] = useState(false)
	const [loudnessEnabled, setLoudnessEnabled] = useState(() =>
		desktopAudioEngine.isLoudnessNormalizationEnabled(),
	)

	const currentTrack = getCurrentTrack()
	const biliTrack =
		currentTrack?.source === 'bilibili' ? (currentTrack as BilibiliTrack) : null
	const currentQualityId = biliTrack?.bilibiliMetadata?.bilibiliStreamUrl?.quality
	const badgeInfo = currentTrack ? getQualityBadgeInfo(currentQualityId) : null

	const [splContent, setSplContent] = useState<string>('')
	const [lyricOffsetSec, setLyricOffsetSec] = useState<number>(0)
	const [lyricModalOpen, setLyricModalOpen] = useState(false)

	// Auto fetch lyrics & offset on currentTrack change
	useEffect(() => {
		let cancelled = false
		if (currentTrack) {
			setLyricOffsetSec(getStoredLyricOffset(currentTrack.uniqueKey))
			lyricService.fetchLyricForTrack(currentTrack).then((res) => {
				if (!cancelled) {
					setSplContent(res?.splContent || '')
				}
			})
		} else {
			setSplContent('')
			setLyricOffsetSec(0)
		}
		return () => {
			cancelled = true
		}
	}, [currentTrack?.uniqueKey])

	// Listen for custom lyric & offset changes
	useEffect(() => {
		const handleCustomLyric = (e: any) => {
			if (e.detail?.trackKey === currentTrack?.uniqueKey) {
				setSplContent(e.detail.splContent)
			}
		}
		const handleOffsetChange = (e: any) => {
			if (e.detail?.trackKey === currentTrack?.uniqueKey) {
				setLyricOffsetSec(
					e.detail.offsetSec ?? getStoredLyricOffset(currentTrack.uniqueKey),
				)
			}
		}
		window.addEventListener('bbplayer:custom-lyric-change', handleCustomLyric)
		window.addEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		return () => {
			window.removeEventListener('bbplayer:custom-lyric-change', handleCustomLyric)
			window.removeEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		}
	}, [currentTrack?.uniqueKey])

	const splData = useMemo(() => {
		if (!splContent) return null
		try {
			return parseSpl(splContent)
		} catch {
			return null
		}
	}, [splContent])

	const currentLine = useMemo(() => {
		if (!splData || splData.lines.length === 0) return null
		const ms = (currentTime + lyricOffsetSec) * 1000
		for (let i = splData.lines.length - 1; i >= 0; i--) {
			if (ms >= splData.lines[i]!.startTime) {
				return splData.lines[i]!
			}
		}
		return splData.lines[0] || null
	}, [splData, currentTime, lyricOffsetSec])

	useEffect(() => {
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			if (event.type === 'play') setIsPlaying(true)
			if (event.type === 'pause') setIsPlaying(false)
			if (event.type === 'timeupdate') {
				setCurrentTime(event.currentTime)
				setDuration(event.duration || 0)
			}
			if (event.type === 'ended') {
				const prevUniqueKey = desktopAudioEngine.getCurrentTrack()?.uniqueKey
				const nextTrack = next()
				if (!nextTrack) {
					setIsPlaying(false)
				} else if (nextTrack.uniqueKey === prevUniqueKey) {
					// 单曲循环或列表仅一首歌循环时，由于 currentTrack 引用未变，直接原地从 0 秒重播
					desktopAudioEngine.seek(0)
					desktopAudioEngine.play().catch((err) =>
						console.error('Failed to replay track on repeat_one:', err),
					)
				}
			}
		})

		return unsubscribe
	}, [next])

	useEffect(() => {
		desktopAudioEngine.setupMediaSessionHandlers({
			onPlay: () => desktopAudioEngine.play(),
			onPause: () => desktopAudioEngine.pause(),
			onNext: () => next(),
			onPrev: () => prev(),
			onSeek: (time) => desktopAudioEngine.seek(time),
		})
	}, [next, prev])

	useEffect(() => {
		if (
			currentTrack &&
			currentTrack.uniqueKey !== desktopAudioEngine.getCurrentTrack()?.uniqueKey
		) {
			playTrackWithProxy(currentTrack).catch((err) =>
				console.error('Failed to auto play track:', err),
			)
		}
	}, [currentTrack])

	const togglePlayPause = async () => {
		if (isPlaying) {
			desktopAudioEngine.pause()
		} else {
			if (
				currentTrack &&
				currentTrack.uniqueKey !== desktopAudioEngine.getCurrentTrack()?.uniqueKey
			) {
				try {
					await playTrackWithProxy(currentTrack)
				} catch (err) {
					console.error('Failed to play track:', err)
				}
			} else {
				await desktopAudioEngine.play()
			}
		}
	}

	const handleSeek = (fraction: number) => {
		const seekTime = fraction * duration
		desktopAudioEngine.seek(seekTime)
		setCurrentTime(seekTime)
	}

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value)
		setVolume(val)
		setIsMuted(val === 0)
		desktopAudioEngine.setVolume(val)
	}

	const toggleMute = () => {
		if (isMuted) {
			setIsMuted(false)
			desktopAudioEngine.setVolume(volume || 0.5)
		} else {
			setIsMuted(true)
			desktopAudioEngine.setVolume(0)
		}
	}

	const togglePlayMode = () => {
		const modes: ('sequential' | 'shuffle' | 'repeat_all' | 'repeat_one')[] = [
			'sequential',
			'shuffle',
			'repeat_all',
			'repeat_one',
		]
		const nextIdx = (modes.indexOf(playMode) + 1) % modes.length
		setPlayMode(modes[nextIdx]!)
	}

	const toggleLoudnessNormalization = () => {
		const nextState = !loudnessEnabled
		setLoudnessEnabled(nextState)
		desktopAudioEngine.setLoudnessNormalization(nextState)
	}

	const progress = duration > 0 ? currentTime / duration : 0
	const primaryColor = themeColors?.color || '#00AEEC'

	return (
		<footer className="h-20 w-full flex flex-col justify-between px-4 py-2 select-none bg-background/60 backdrop-blur-2xl border-t border-white/5 z-40">
			{/* Top: Wavy Progress Bar */}
			<div className="w-full -mt-1 px-2">
				<WavySlider
					value={progress}
					duration={duration}
					isPlaying={isPlaying}
					onChange={handleSeek}
					primaryColor={primaryColor}
				/>
			</div>

			{/* Bottom: 3-column control bar */}
			<div className="w-full flex items-center justify-between">
				{/* Left: Track Information */}
				<div className="flex items-center gap-3 w-1/4 min-w-[200px]">
					{currentTrack ? (
						<>
							<div
								onClick={onToggleFullscreenLyrics}
								className="relative group cursor-pointer w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 shadow-sm"
							>
								<img
									src={
										currentTrack.coverUrl ||
										'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
									}
									alt={currentTrack.title}
									referrerPolicy="no-referrer"
									className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
								/>
								<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
									<Maximize2 className="w-4 h-4 text-white" />
								</div>
							</div>
							<div className="overflow-hidden">
								<p
									onClick={onToggleFullscreenLyrics}
									className="text-xs font-semibold truncate hover:underline cursor-pointer text-foreground"
								>
									{currentTrack.title}
								</p>
								<div className="flex items-center gap-1.5 mt-0.5">
									<p className="text-[11px] text-muted-foreground truncate max-w-[130px]">
										{currentTrack.artist?.name || '未知歌手'}
									</p>
									{badgeInfo && (
										<span
											className={`text-[9px] px-1 py-0.2 rounded font-medium border leading-tight ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.color}`}
											title={`当前音频流质量 ID: ${currentQualityId || '默认'}`}
										>
											{badgeInfo.text}
										</span>
									)}
								</div>
							</div>
						</>
					) : (
						<div className="flex items-center gap-2.5 text-muted-foreground text-xs">
							<div className="w-11 h-11 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
								🎵
							</div>
							<span>未在播放歌曲</span>
						</div>
					)}
				</div>

				{/* Center: Status Bar Lyrics & Playback Controls */}
				<div className="flex flex-col items-center justify-center flex-1 max-w-lg px-2">
					{/* Status Bar Lyric */}
					<div
						onClick={onToggleFullscreenLyrics}
						className="h-4 flex items-center justify-center gap-2 cursor-pointer text-center overflow-hidden max-w-md group mb-1"
						title="状态栏歌词 (点击展开沉浸式全屏歌词)"
					>
						{currentLine ? (
							<div className="flex items-center gap-2 text-xs truncate">
								<span className="font-semibold text-foreground/90 group-hover:text-primary transition-colors truncate">
									{currentLine.content}
								</span>
								{currentLine.translation && (
									<span className="text-[11px] text-muted-foreground/80 hidden sm:inline group-hover:text-sky-300 transition-colors truncate">
										{currentLine.translation}
									</span>
								)}
							</div>
						) : (
							<span className="text-[10px] text-muted-foreground/50 tracking-wider">
								{currentTrack ? '♪ 沉浸聆听中 · 点击右侧调整歌词' : 'BBPlayer 全能音乐播放器'}
							</span>
						)}
					</div>

					{/* Playback Controls */}
					<div className="flex items-center gap-4">
						<button
							onClick={togglePlayMode}
							title={`播放模式: ${playMode}`}
							className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						>
							{playMode === 'shuffle' && <Shuffle className="w-4 h-4 text-primary" />}
							{playMode === 'repeat_one' && <Repeat1 className="w-4 h-4 text-primary" />}
							{playMode === 'repeat_all' && <Repeat className="w-4 h-4 text-primary" />}
							{playMode === 'sequential' && <Repeat className="w-4 h-4" />}
						</button>

						<button
							onClick={prev}
							title="上一曲"
							className="p-1.5 rounded-full hover:bg-white/10 text-foreground transition-colors"
						>
							<SkipBack className="w-5 h-5 fill-current" />
						</button>

						<button
							onClick={togglePlayPause}
							title={isPlaying ? '暂停' : '播放'}
							className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md"
							style={{ backgroundColor: primaryColor }}
						>
							{isPlaying ? (
								<Pause className="w-4 h-4 fill-current" />
							) : (
								<Play className="w-4 h-4 fill-current ml-0.5" />
							)}
						</button>

						<button
							onClick={next}
							title="下一曲"
							className="p-1.5 rounded-full hover:bg-white/10 text-foreground transition-colors"
						>
							<SkipForward className="w-5 h-5 fill-current" />
						</button>

						<button
							onClick={toggleLoudnessNormalization}
							title={loudnessEnabled ? '已开启响度均衡' : '已关闭响度均衡'}
							className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${
								loudnessEnabled ? 'text-primary' : 'text-muted-foreground'
							}`}
						>
							<Sliders className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Right: Volume & Lyric Trigger */}
				<div className="flex items-center justify-end gap-2.5 w-1/4 min-w-[200px]">
					<div className="flex items-center gap-1.5">
						<button
							onClick={toggleMute}
							className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
						>
							{isMuted || volume === 0 ? (
								<VolumeX className="w-4 h-4" />
							) : (
								<Volume2 className="w-4 h-4" />
							)}
						</button>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={isMuted ? 0 : volume}
							onChange={handleVolumeChange}
							className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>

					<button
						onClick={() => setLyricModalOpen(true)}
						title="歌词微调与智能搜索匹配"
						className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
					>
						<FileText className="w-4 h-4" />
					</button>

					<button
						onClick={onToggleFullscreenLyrics}
						title="全屏沉浸歌词模式"
						className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
					>
						<Maximize2 className="w-4 h-4" />
					</button>
				</div>
			</div>

			<LyricsSettingsModal
				isOpen={lyricModalOpen}
				onClose={() => setLyricModalOpen(false)}
				track={currentTrack}
				onLyricsUpdated={(spl) => {
					setSplContent(spl)
					if (currentTrack) {
						window.dispatchEvent(
							new CustomEvent('bbplayer:custom-lyric-change', {
								detail: { trackKey: currentTrack.uniqueKey, splContent: spl },
							}),
						)
					}
				}}
			/>
		</footer>
	)
}
```

---

### 文件 6：`apps/desktop/src/components/player/ImmersiveLyricsView.tsx`
* **修改说明**：
  1. 接入 `getStoredLyricOffset` 与 `bbplayer:lyric-offset-change` 事件监听，使全屏歌词支持单曲时间轴微调。
  2. 支持点击任意一句歌词跳转到对应播放时间点（`desktopAudioEngine.seek`）。
  3. 支持按 `Escape` 键关闭全屏歌词，并保留 `AnimatePresence` 退出动画。

```tsx
import React, { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { FluidBackground } from './FluidBackground'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import { getStoredLyricOffset } from '../../services/lyricService'
import { parseSpl, type SplLyricData } from '@bbplayer/splash'
import type { Track } from '@bbplayer/shared-core'

export interface ImmersiveLyricsViewProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
	splContent?: string | null
}

const DEFAULT_SPL_SAMPLE = `[ti:BBPlayer]
[ar:洛天依]
[00:00.00]BBPlayer 沉浸式全屏歌词模式
[00:04.00]让音乐与视觉在这一刻完美共鸣
[00:08.50]支持 SPL 逐字音节染色与罗马音双语对照
[00:14.00]跟随音轨流动，感受细腻律动
[00:20.00]♪ ♫ ♩ ♬
`

export const ImmersiveLyricsView: React.FC<ImmersiveLyricsViewProps> = ({
	isOpen,
	onClose,
	track,
	splContent,
}) => {
	const [currentTime, setCurrentTime] = useState(() =>
		desktopAudioEngine.getCurrentTime(),
	)
	const [lyricOffsetSec, setLyricOffsetSec] = useState(0)
	const lyricsContainerRef = useRef<HTMLDivElement | null>(null)
	const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())
	const haloCanvasRef = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		if (track) {
			setLyricOffsetSec(getStoredLyricOffset(track.uniqueKey))
		} else {
			setLyricOffsetSec(0)
		}
	}, [track?.uniqueKey, isOpen])

	useEffect(() => {
		const handleOffsetChange = (e: any) => {
			if (track && e.detail?.trackKey === track.uniqueKey) {
				setLyricOffsetSec(
					e.detail.offsetSec ?? getStoredLyricOffset(track.uniqueKey),
				)
			}
		}
		window.addEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		return () => {
			window.removeEventListener('bbplayer:lyric-offset-change', handleOffsetChange)
		}
	}, [track?.uniqueKey])

	const lyricsData: SplLyricData = useMemo(() => {
		try {
			return parseSpl(splContent || DEFAULT_SPL_SAMPLE)
		} catch {
			return parseSpl(DEFAULT_SPL_SAMPLE)
		}
	}, [splContent])

	// Subscribe to audio engine timeupdate & Escape key to close
	useEffect(() => {
		if (!isOpen) return
		setCurrentTime(desktopAudioEngine.getCurrentTime())
		const unsubscribe = desktopAudioEngine.subscribe((event) => {
			if (event.type === 'timeupdate') {
				setCurrentTime(event.currentTime)
			}
		})

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			unsubscribe()
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen, onClose])

	const currentTimeMs = Math.max(0, (currentTime + lyricOffsetSec) * 1000)

	// Find active line index
	const activeIndex = useMemo(() => {
		const lines = lyricsData.lines
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!
			if (currentTimeMs >= line.startTime && currentTimeMs < line.endTime) {
				return i
			}
		}
		for (let i = lines.length - 1; i >= 0; i--) {
			if (currentTimeMs >= lines[i]!.startTime) {
				return i
			}
		}
		return 0
	}, [lyricsData.lines, currentTimeMs])

	// Auto scroll to active line
	useEffect(() => {
		if (!isOpen) return
		const el = lineRefs.current.get(activeIndex)
		if (el && lyricsContainerRef.current) {
			el.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
			})
		}
	}, [activeIndex, isOpen])

	// Audio Halo Visualizer on Left Cover
	useEffect(() => {
		if (!isOpen) return
		const canvas = haloCanvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		let animId: number
		const freqBuffer = new Uint8Array(128)

		const renderHalo = () => {
			desktopAudioEngine.getFrequencyData(freqBuffer)
			let sum = 0
			for (let i = 0; i < 32; i++) {
				sum += freqBuffer[i]!
			}
			const avgEnergy = sum / 32 / 255 // 0.0 to 1.0

			const w = (canvas.width = canvas.offsetWidth)
			const h = (canvas.height = canvas.offsetHeight)
			ctx.clearRect(0, 0, w, h)

			const cx = w / 2
			const cy = h / 2
			const baseR = Math.min(w, h) * 0.42
			const pulseR = baseR + avgEnergy * 28

			const grad = ctx.createRadialGradient(cx, cy, baseR * 0.8, cx, cy, pulseR)
			grad.addColorStop(0, 'rgba(0, 174, 236, 0.4)')
			grad.addColorStop(0.5, 'rgba(255, 46, 147, 0.3)')
			grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

			ctx.fillStyle = grad
			ctx.beginPath()
			ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
			ctx.fill()

			animId = requestAnimationFrame(renderHalo)
		}

		animId = requestAnimationFrame(renderHalo)
		return () => cancelAnimationFrame(animId)
	}, [isOpen])

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0, y: '100%' }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: '100%' }}
					transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
					className="fixed inset-0 z-50 overflow-hidden flex flex-col bg-background text-foreground select-none"
				>
					{/* Fluid ambient canvas background */}
					<FluidBackground coverUrl={track?.coverUrl} />

					{/* Top bar */}
					<header
						data-tauri-drag-region
						className="relative z-10 h-14 w-full flex items-center justify-between px-6 bg-black/20 backdrop-blur-md border-b border-white/5"
					>
						<div className="flex items-center gap-2">
							<div className="w-5 h-5 rounded-md bg-gradient-to-tr from-pink-500 to-sky-400 flex items-center justify-center text-white font-bold text-[10px]">
								BB
							</div>
							<span className="text-xs font-semibold text-white/80">
								沉浸式 SPL 歌词体验
							</span>
						</div>

						<button
							onClick={onClose}
							className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
							title="关闭全屏 (Esc)"
						>
							<X className="w-5 h-5" />
						</button>
					</header>

					{/* Main Stage: Left Cover Halo + Right Dynamic Lyrics */}
					<main className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-between px-8 md:px-16 py-6 overflow-hidden gap-12">
						{/* Left: Album Cover & Audio Halo */}
						<div className="w-full md:w-5/12 flex flex-col items-center justify-center relative">
							<div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
								<canvas
									ref={haloCanvasRef}
									className="absolute inset-0 w-full h-full pointer-events-none scale-125"
								/>
								<div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-white/15 z-10 bg-black/40">
									<img
										src={
											track?.coverUrl ||
											'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
										}
										alt={track?.title || 'BBPlayer'}
										referrerPolicy="no-referrer"
										className="w-full h-full object-cover"
									/>
								</div>
							</div>

							{/* Track info summary */}
							<div className="mt-6 text-center space-y-1 z-10">
								<h1 className="text-lg md:text-xl font-bold tracking-tight text-white drop-shadow">
									{track?.title || '未在播放歌曲'}
								</h1>
								<p className="text-xs md:text-sm text-white/70 font-medium">
									{track?.artist?.name || '未知歌手'}
								</p>
							</div>
						</div>

						{/* Right: Dynamic Syllable Lyrics Stream */}
						<div
							ref={lyricsContainerRef}
							className="w-full md:w-7/12 h-full overflow-y-auto no-scrollbar py-28 space-y-8 text-left scroll-smooth"
						>
							{lyricsData.lines.map((line, idx) => {
								const isActive = idx === activeIndex
								const distance = Math.abs(idx - activeIndex)
								const blurAmount = distance === 0 ? 0 : distance === 1 ? 1.5 : 3
								const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : 0.25

								return (
									<div
										key={idx}
										onClick={() => {
											desktopAudioEngine.seek(
												Math.max(0, line.startTime / 1000 - lyricOffsetSec),
											)
										}}
										ref={(el) => {
											if (el) lineRefs.current.set(idx, el)
											else lineRefs.current.delete(idx)
										}}
										className="transition-all duration-300 transform origin-left cursor-pointer hover:opacity-90"
										style={{
											filter: `blur(${blurAmount}px)`,
											opacity,
											scale: isActive ? 1.04 : 1.0,
										}}
									>
										{/* Main line with syllable highlight */}
										<p className="text-xl md:text-2xl font-bold tracking-wide leading-relaxed">
											{line.isDynamic && line.spans && line.spans.length > 0 ? (
												line.spans.map((span, sIdx) => {
													let fillPct = 0
													if (currentTimeMs >= span.endTime) {
														fillPct = 100
													} else if (currentTimeMs > span.startTime) {
														fillPct = Math.min(
															100,
															((currentTimeMs - span.startTime) /
																(span.duration || 1)) *
																100,
														)
													}

													return (
														<span
															key={sIdx}
															className="inline-block transition-all duration-75"
															style={{
																background: `linear-gradient(to right, #00AEEC ${fillPct}%, rgba(255, 255, 255, 0.5) ${fillPct}%)`,
																WebkitBackgroundClip: 'text',
																WebkitTextFillColor: 'transparent',
															}}
														>
															{span.text}
														</span>
													)
												})
											) : (
												<span
													className={
														isActive
															? 'text-primary drop-shadow-[0_2px_12px_rgba(0,174,236,0.6)]'
															: 'text-white/60'
													}
												>
													{line.content}
												</span>
											)}
										</p>

										{/* Romaji syllable translation */}
										{line.romaji && (
											<p className="text-xs text-white/50 font-mono mt-1">
												{line.romaji}
											</p>
										)}

										{/* Bilingual translated line */}
										{line.translation && (
											<p className="text-sm text-sky-200/75 mt-1 font-medium">
												{line.translation}
											</p>
										)}
									</div>
								)
							})}
						</div>
					</main>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
```

---

### 文件 7：`apps/desktop/src/components/modals/ExportTrackModal.tsx`
* **修改说明**：
  1. 移除写死的 `C:\Users\szd\Desktop\` 路径，改用 `@tauri-apps/api/path` 的 `desktopDir()` / `downloadDir()` + `join()` 跨平台获取真实路径。
  2. 使用 `createPortal(..., document.body)` 挂载弹窗。

```tsx
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, FileAudio, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { desktopDir, downloadDir, join } from '@tauri-apps/api/path'
import type { Track, BilibiliTrack } from '@bbplayer/shared-core'

export interface ExportTrackModalProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
}

export const ExportTrackModal: React.FC<ExportTrackModalProps> = ({
	isOpen,
	onClose,
	track,
}) => {
	const [cachedPath, setCachedPath] = useState<string | null>(null)
	const [isExporting, setIsExporting] = useState(false)
	const [exportSuccess, setExportSuccess] = useState(false)
	const [outputPath, setOutputPath] = useState('')
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setExportSuccess(false)
		setError(null)
		if (isOpen && track && track.source === 'bilibili') {
			const bili = track as BilibiliTrack
			const bvid = bili.bilibiliMetadata.bvid
			const cid = bili.bilibiliMetadata.cid || 0

			invoke<string | null>('get_cached_track_path', { bvid, cid })
				.then(async (path) => {
					setCachedPath(path)
					if (path) {
						const defaultName = `${track.title} - ${
							track.artist?.name || '未知歌手'
						}.m4a`.replace(/[\\/:*?"<>|]/g, '_')

						try {
							const baseDir = (await desktopDir().catch(() => downloadDir())) || ''
							const fullPath = baseDir
								? await join(baseDir, defaultName)
								: defaultName
							setOutputPath(fullPath)
						} catch {
							setOutputPath(defaultName)
						}
					}
				})
				.catch((err) => console.error(err))
		}
	}, [isOpen, track])

	if (!isOpen || !track) return null

	const handleExport = async () => {
		if (!cachedPath || !outputPath) return
		setIsExporting(true)
		setError(null)
		try {
			await invoke('export_cached_track_to_m4a', {
				params: {
					cached_file_path: cachedPath,
					output_path: outputPath,
					title: track.title,
					artist: track.artist?.name || '未知歌手',
					album: 'BBPlayer',
					cover_url: track.coverUrl,
					lyrics: null,
				},
			})
			setIsExporting(false)
			setExportSuccess(true)
		} catch (err: any) {
			setIsExporting(false)
			setError(err?.message || String(err))
		}
	}

	return createPortal(
		<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-md rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden p-6 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<FileAudio className="w-3.5 h-3.5" />
						</div>
						<h3 className="text-sm font-bold text-foreground">
							导出为标准 .m4a 音频
						</h3>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{exportSuccess ? (
					<div className="space-y-4 py-3">
						<div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
							<CheckCircle2 className="w-5 h-5 flex-shrink-0" />
							<div className="overflow-hidden">
								<p className="font-semibold">音频导出成功！</p>
								<p className="text-[11px] text-emerald-300/80 truncate" title={outputPath}>
									已保存至: {outputPath}
								</p>
							</div>
						</div>
						<div className="flex justify-end pt-2">
							<button
								onClick={onClose}
								className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white"
							>
								完成
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<div className="space-y-1">
							<p className="text-xs font-semibold text-foreground">
								{track.title}
							</p>
							<p className="text-[11px] text-muted-foreground">
								{track.artist?.name || '未知歌手'}
							</p>
						</div>

						{cachedPath ? (
							<div className="space-y-3">
								<div className="space-y-1.5">
									<label className="text-[11px] font-semibold text-foreground/80">
										导出目标路径
									</label>
									<input
										type="text"
										value={outputPath}
										onChange={(e) => setOutputPath(e.target.value)}
										className="w-full h-8 px-3 text-xs rounded-xl bg-white/5 border border-white/10 text-foreground outline-none font-mono"
									/>
								</div>
								<p className="text-[10px] text-muted-foreground">
									将自动内嵌高清封面二进制、歌名、UP主元数据与标准 MPEG-4 容器。
								</p>
							</div>
						) : (
							<div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
								该歌曲尚未完成本地流媒体缓存，请先播放试听该歌曲，流媒体代理将自动完成无损落盘缓存。
							</div>
						)}

						{error && (
							<div className="flex items-center gap-2 p-2 rounded-xl bg-red-500/10 text-xs text-red-400">
								<AlertCircle className="w-4 h-4 flex-shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={onClose}
								className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:bg-white/5"
							>
								取消
							</button>
							<button
								onClick={handleExport}
								disabled={!cachedPath || isExporting}
								className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 shadow-md"
							>
								{isExporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
								<span>立即导出</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</div>,
		document.body,
	)
}
```

---

### 文件 8：`apps/desktop/src/components/modals/LyricsSettingsModal.tsx`
* **修改说明**：
  1. 将原混淆命名的 `offsetMs` 统一正名为 `offsetSec`（单位为秒）。
  2. 在 `handleAdjustOffset` 和 `handleResetOffset` 中派发 `window.dispatchEvent(new CustomEvent('bbplayer:lyric-offset-change', { detail: { trackKey: track.uniqueKey, offsetSec } }))`，通知全站歌词组件立即刷新时间轴。

```tsx
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
	X,
	FileText,
	Search,
	Check,
	RotateCcw,
	Loader2,
	Save,
} from 'lucide-react'
import type { Track } from '@bbplayer/shared-core'
import {
	lyricService,
	getStoredLyricOffset,
	setStoredLyricOffset,
	getStoredCustomLyric,
	setStoredCustomLyric,
	type LyricSearchCandidate,
} from '../../services/lyricService'

export interface LyricsSettingsModalProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
	onLyricsUpdated?: (splContent: string) => void
}

export const LyricsSettingsModal: React.FC<LyricsSettingsModalProps> = ({
	isOpen,
	onClose,
	track,
	onLyricsUpdated,
}) => {
	const [activeTab, setActiveTab] = useState<'search' | 'custom' | 'offset'>('search')
	const [searchKeyword, setSearchKeyword] = useState('')
	const [candidates, setCandidates] = useState<LyricSearchCandidate[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [customText, setCustomText] = useState('')
	const [offsetSec, setOffsetSec] = useState(0)
	const [loadingCandidateId, setLoadingCandidateId] = useState<string | number | null>(null)
	const [successMsg, setSuccessMsg] = useState<string | null>(null)

	useEffect(() => {
		if (isOpen && track) {
			const fullTitle = track.title.trim()
			setSearchKeyword(fullTitle)
			setOffsetSec(getStoredLyricOffset(track.uniqueKey))
			setCustomText(getStoredCustomLyric(track.uniqueKey) || '')
			handleSearch(fullTitle)
		}
	}, [isOpen, track])

	if (!isOpen || !track) return null

	const handleSearch = async (kw: string) => {
		if (!kw.trim()) return
		setIsSearching(true)
		try {
			const results = await lyricService.searchCandidates(kw.trim())
			setCandidates(results)
		} catch (err) {
			console.warn('Search lyrics error:', err)
		} finally {
			setIsSearching(false)
		}
	}

	const handleApplyCandidate = async (candidate: LyricSearchCandidate) => {
		setLoadingCandidateId(candidate.id)
		try {
			const spl = await lyricService.fetchCandidateLyrics(candidate)
			if (spl) {
				setStoredCustomLyric(track.uniqueKey, spl)
				onLyricsUpdated?.(spl)
				setSuccessMsg(`已成功应用【${candidate.title}】的歌词！`)
				setTimeout(() => setSuccessMsg(null), 2000)
			}
		} catch (err) {
			console.error('Failed to apply lyrics:', err)
		} finally {
			setLoadingCandidateId(null)
		}
	}

	const handleSaveCustom = () => {
		if (!customText.trim()) return
		setStoredCustomLyric(track.uniqueKey, customText.trim())
		onLyricsUpdated?.(customText.trim())
		setSuccessMsg('已保存自定义歌词！')
		setTimeout(() => setSuccessMsg(null), 2000)
	}

	const handleAdjustOffset = (deltaSec: number) => {
		const next = Math.round((offsetSec + deltaSec) * 10) / 10
		setOffsetSec(next)
		setStoredLyricOffset(track.uniqueKey, next)
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyric-offset-change', {
				detail: { trackKey: track.uniqueKey, offsetSec: next },
			}),
		)
	}

	const handleResetOffset = () => {
		setOffsetSec(0)
		setStoredLyricOffset(track.uniqueKey, 0)
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyric-offset-change', {
				detail: { trackKey: track.uniqueKey, offsetSec: 0 },
			}),
		)
	}

	return createPortal(
		<div className="fixed inset-0 z-[999] overflow-hidden select-none">
			{/* Backdrop overlay */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
				onClick={onClose}
			/>

			{/* Slide-out Sidebar Drawer */}
			<div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
				<div className="w-screen max-w-md sm:max-w-lg bg-background/95 border-l border-white/10 shadow-2xl flex flex-col p-6 space-y-4 backdrop-blur-xl animate-in slide-in-from-right duration-300">
					{/* Header */}
					<div className="flex items-center justify-between pb-3 border-b border-white/5">
						<div className="flex items-center gap-2.5">
							<div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-sm shadow-primary/20">
								<FileText className="w-4 h-4" />
							</div>
							<div>
								<h3 className="text-sm font-bold text-foreground">
									歌词管理与微调
								</h3>
								<p className="text-[11px] text-muted-foreground truncate max-w-[260px] sm:max-w-xs mt-0.5" title={track.title}>
									{track.title}
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					{/* Tabs */}
					<div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/5">
						<button
							onClick={() => setActiveTab('search')}
							className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
								activeTab === 'search'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							智能搜索匹配
						</button>
						<button
							onClick={() => setActiveTab('custom')}
							className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
								activeTab === 'custom'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							粘贴 LRC/SPL
						</button>
						<button
							onClick={() => setActiveTab('offset')}
							className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
								activeTab === 'offset'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							时间微调 ({offsetSec >= 0 ? `+${offsetSec}` : offsetSec}s)
						</button>
					</div>

					{/* Success Notification */}
					{successMsg && (
						<div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
							<Check className="w-3.5 h-3.5 flex-shrink-0" />
							<span>{successMsg}</span>
						</div>
					)}

					{/* Tab 1: Search */}
					{activeTab === 'search' && (
						<div className="flex-1 flex flex-col min-h-0 space-y-3">
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={searchKeyword}
									onChange={(e) => setSearchKeyword(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchKeyword)}
									placeholder="输入歌曲名 / 歌手重新搜索歌词..."
									className="flex-1 h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none transition-all"
								/>
								<button
									onClick={() => handleSearch(searchKeyword)}
									disabled={isSearching}
									className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
								>
									{isSearching ? (
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
									) : (
										<Search className="w-3.5 h-3.5" />
									)}
									<span>搜索</span>
								</button>
							</div>

							<div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
								{isSearching ? (
									<div className="py-16 text-center space-y-2 text-xs text-muted-foreground">
										<Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
										<p>正在检索网易云与 QQ 音乐歌词库...</p>
									</div>
								) : candidates.length === 0 ? (
									<div className="py-16 text-center text-xs text-muted-foreground">
										未找到匹配歌词，可尝试修改关键词或点击上方“粘贴 LRC/SPL”自定义
									</div>
								) : (
									candidates.map((item) => (
										<div
											key={`${item.source}_${item.id}`}
											className="p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 flex items-center justify-between gap-3 text-xs transition-colors group"
										>
											<div className="overflow-hidden space-y-1 flex-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold text-foreground truncate max-w-[220px]" title={item.title}>
														{item.title}
													</span>
													<span
														className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
															item.source === 'netease'
																? 'bg-red-500/20 text-red-300'
																: 'bg-emerald-500/20 text-emerald-300'
														}`}
													>
														{item.source === 'netease' ? '网易云 (逐字)' : 'QQ音乐'}
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground truncate">
													歌手: {item.artist || '未知'}
												</p>
											</div>

											<button
												onClick={() => handleApplyCandidate(item)}
												disabled={loadingCandidateId === item.id}
												className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
											>
												{loadingCandidateId === item.id && (
													<Loader2 className="w-3 h-3 animate-spin" />
												)}
												<span>采用</span>
											</button>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{/* Tab 2: Custom Text */}
					{activeTab === 'custom' && (
						<div className="flex-1 flex flex-col min-h-0 space-y-3">
							<p className="text-xs text-muted-foreground leading-relaxed">
								支持直接粘贴标准 LRC 文本或包含逐字进度的 SPL (Salt Player Lyrics) 规范文本：
							</p>
							<textarea
								value={customText}
								onChange={(e) => setCustomText(e.target.value)}
								placeholder="例如:&#10;[00:00.00]歌曲开始&#10;[00:04.20]<00:04.20>逐<00:04.50>字<00:05.00>进<00:05.50>度"
								className="flex-1 w-full p-3 text-xs font-mono rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed min-h-[260px]"
							/>
							<div className="flex justify-end pt-2">
								<button
									onClick={handleSaveCustom}
									disabled={!customText.trim()}
									className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow flex items-center gap-1.5 transition-colors disabled:opacity-50"
								>
									<Save className="w-3.5 h-3.5" />
									<span>保存并应用歌词</span>
								</button>
							</div>
						</div>
					)}

					{/* Tab 3: Offset Adjust */}
					{activeTab === 'offset' && (
						<div className="space-y-4 py-2">
							<p className="text-xs text-muted-foreground leading-relaxed">
								当音频片头片尾导致歌词与声音不同步时，可按需微调时间轴偏移量：
							</p>

							<div className="text-center py-6 bg-white/[0.02] rounded-xl border border-white/5 space-y-1">
								<span className="text-2xl font-bold font-mono text-primary">
									{offsetSec >= 0 ? `+${offsetSec.toFixed(2)}` : offsetSec.toFixed(2)} 秒
								</span>
								<p className="text-[11px] text-muted-foreground">
									{offsetSec > 0 ? '歌词提前显示' : offsetSec < 0 ? '歌词延后显示' : '标准同步'}
								</p>
							</div>

							<div className="grid grid-cols-5 gap-2">
								<button
									onClick={() => handleAdjustOffset(-0.5)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									-0.5s
								</button>
								<button
									onClick={() => handleAdjustOffset(-0.1)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									-0.1s
								</button>
								<button
									onClick={handleResetOffset}
									className="py-2.5 text-xs rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 font-medium flex items-center justify-center gap-1 transition-colors"
								>
									<RotateCcw className="w-3 h-3" />
									<span>重置</span>
								</button>
								<button
									onClick={() => handleAdjustOffset(0.1)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									+0.1s
								</button>
								<button
									onClick={() => handleAdjustOffset(0.5)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									+0.5s
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>,
		document.body,
	)
}
```

---

### 文件 9：`apps/desktop/src/components/modals/AddToPlaylistModal.tsx`
* **修改说明**：
  1. 遵循《UI 架构与排错优化开发指南》“陷阱 1”，由于 `AddToPlaylistModal` 在 `SearchView` 内被调用，处于主内容滚动视口内部，必须使用 `createPortal(..., document.body)` 挂载到 `document.body` 并设置 `z-[999]`。

```tsx
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, FolderPlus, Plus, Music, Check } from 'lucide-react'
import { useLocalPlaylistStore, type Track } from '@bbplayer/shared-core'

export interface AddToPlaylistModalProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
	isOpen,
	onClose,
	track,
}) => {
	const { playlists, addTrackToPlaylist, createPlaylist } = useLocalPlaylistStore()
	const [newTitle, setNewTitle] = useState('')
	const [isCreating, setIsCreating] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	if (!isOpen || !track) return null

	const handleAdd = (playlistId: string, playlistTitle: string) => {
		const success = addTrackToPlaylist(playlistId, track)
		if (success) {
			setMessage(`已成功添加至【${playlistTitle}】`)
			setTimeout(() => {
				setMessage(null)
				onClose()
			}, 1200)
		} else {
			setMessage(`【${playlistTitle}】中已存在该曲目`)
			setTimeout(() => setMessage(null), 1500)
		}
	}

	const handleCreateAndAdd = () => {
		if (!newTitle.trim()) return
		const newPl = createPlaylist(
			newTitle.trim(),
			'',
			track.coverUrl || undefined,
			[track],
		)
		setMessage(`已创建【${newPl.title}】并成功添加歌曲`)
		setTimeout(() => {
			setMessage(null)
			setNewTitle('')
			setIsCreating(false)
			onClose()
		}, 1200)
	}

	return createPortal(
		<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-sm rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col p-5 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<FolderPlus className="w-4 h-4" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-foreground">添加到歌单</h3>
							<p
								className="text-[10px] text-muted-foreground truncate max-w-[200px]"
								title={track.title}
							>
								{track.title}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Notice */}
				{message && (
					<div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
						<Check className="w-3.5 h-3.5 flex-shrink-0" />
						<span>{message}</span>
					</div>
				)}

				{/* Playlists List */}
				<div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
					{playlists.length === 0 ? (
						<div className="py-6 text-center text-xs text-muted-foreground">
							我的音乐库中暂无歌单，可点击下方新建歌单
						</div>
					) : (
						playlists.map((pl) => (
							<div
								key={pl.id}
								onClick={() => handleAdd(pl.id, pl.title)}
								className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
							>
								<div className="flex items-center gap-2.5 overflow-hidden">
									<div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary overflow-hidden flex-shrink-0">
										{pl.coverUrl ? (
											<img
												src={pl.coverUrl}
												alt=""
												referrerPolicy="no-referrer"
												className="w-full h-full object-cover"
											/>
										) : (
											<Music className="w-4 h-4" />
										)}
									</div>
									<div className="overflow-hidden">
										<p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
											{pl.title}
										</p>
										<p className="text-[10px] text-muted-foreground">
											{pl.tracks.length} 首歌曲
										</p>
									</div>
								</div>
								<Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
							</div>
						))
					)}
				</div>

				{/* Create New Playlist Inline */}
				<div className="pt-2 border-t border-white/5">
					{isCreating ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
								placeholder="新歌单名称..."
								autoFocus
								className="flex-1 h-8 px-2.5 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none"
							/>
							<button
								onClick={handleCreateAndAdd}
								disabled={!newTitle.trim()}
								className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors disabled:opacity-50"
							>
								新建并添加
							</button>
						</div>
					) : (
						<button
							onClick={() => setIsCreating(true)}
							className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
						>
							<Plus className="w-3.5 h-3.5" />
							<span>新建歌单并添加</span>
						</button>
					)}
				</div>
			</div>
		</div>,
		document.body,
	)
}
```

---

### 文件 10：`apps/desktop/src/windows/lyrics/DesktopLyricsApp.tsx`
* **修改说明**：
  1. 新增对 `lyrics-lock-change` 事件的监听，确保当用户按下全局快捷键 `Ctrl+Alt+L` 切换鼠标穿透时，歌词小窗的 `isLocked` 状态、半透明背景框与顶部控制栏同步隐藏或显现。
  2. 修正锁定按钮的快捷键提示文案为 `Ctrl+Alt+L`。

```tsx
import React, { useState, useEffect, useMemo } from 'react'
import { Lock, X } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { parseSpl, type SplLyricData, type LyricLine } from '@bbplayer/splash'

export type LyricsSyncEvent =
	| {
			type: 'TRACK_CHANGE'
			splContent?: string
			durationMs: number
			title: string
			artist: string
	  }
	| {
			type: 'STATE_SYNC'
			isPlaying: boolean
			currentTimeMs: number
			timestamp: number
	  }
	| {
			type: 'STYLE_UPDATE'
			fontSize: number
			primaryColor: string
			lockMouse: boolean
	  }

export const DesktopLyricsApp: React.FC = () => {
	const [isLocked, setIsLocked] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTimeMs, setCurrentTimeMs] = useState(0)
	const [title, setTitle] = useState('BBPlayer 桌面歌词')
	const [artist, setArtist] = useState('欢迎使用')
	const [splContent, setSplContent] = useState<string | null>(null)
	const [fontSize, setFontSize] = useState(22)
	const [primaryColor, setPrimaryColor] = useState('#00AEEC')

	// Parse SPL lyrics when content changes
	const lyricsData: SplLyricData | null = useMemo(() => {
		if (!splContent) return null
		try {
			return parseSpl(splContent)
		} catch {
			return null
		}
	}, [splContent])

	// IPC Event Listener from Main Window & Global Shortcuts
	useEffect(() => {
		const unlistenSyncPromise = listen<LyricsSyncEvent>('lyrics-sync', (event) => {
			const payload = event.payload
			if (payload.type === 'TRACK_CHANGE') {
				setTitle(payload.title)
				setArtist(payload.artist)
				if (payload.splContent !== undefined) {
					setSplContent(payload.splContent || null)
				}
			} else if (payload.type === 'STATE_SYNC') {
				setIsPlaying(payload.isPlaying)
				setCurrentTimeMs(payload.currentTimeMs)
			} else if (payload.type === 'STYLE_UPDATE') {
				setFontSize(payload.fontSize)
				setPrimaryColor(payload.primaryColor)
				setIsLocked(payload.lockMouse)
			}
		})

		const unlistenLockPromise = listen<boolean>('lyrics-lock-change', (event) => {
			setIsLocked( Boolean(event.payload) )
		})

		return () => {
			unlistenSyncPromise.then((unlisten) => unlisten())
			unlistenLockPromise.then((unlisten) => unlisten())
		}
	}, [])

	// Determine active line
	const activeLine: LyricLine | null = useMemo(() => {
		if (!lyricsData || lyricsData.lines.length === 0) return null
		for (const line of lyricsData.lines) {
			if (currentTimeMs >= line.startTime && currentTimeMs < line.endTime) {
				return line
			}
		}
		for (let i = lyricsData.lines.length - 1; i >= 0; i--) {
			if (currentTimeMs >= lyricsData.lines[i]!.startTime) {
				return lyricsData.lines[i]!
			}
		}
		return lyricsData.lines[0] || null
	}, [lyricsData, currentTimeMs])

	const toggleLock = async () => {
		const nextLocked = !isLocked
		try {
			await invoke('set_ignore_cursor_events', { ignore: nextLocked })
			setIsLocked(nextLocked)
		} catch (err) {
			console.error('Failed to toggle lock mouse:', err)
		}
	}

	const handleClose = async () => {
		try {
			await getCurrentWindow().hide()
		} catch (err) {
			console.error('Failed to hide window:', err)
		}
	}

	return (
		<div
			className={`w-screen h-screen flex flex-col justify-center items-center px-6 relative select-none rounded-2xl transition-all duration-300 group ${
				isLocked
					? 'bg-transparent'
					: 'bg-black/50 hover:bg-black/70 border border-white/10 backdrop-blur-md shadow-2xl'
			}`}
		>
			{/* Top drag & control bar (hidden when mouse locked) */}
			{!isLocked && (
				<div
					data-tauri-drag-region
					className="absolute top-0 left-0 right-0 h-7 flex items-center justify-between px-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-t-2xl cursor-move text-white/80"
				>
					<span className="text-[11px] font-medium tracking-wide truncate max-w-[75%]">
						{title} - {artist}
					</span>
					<div className="flex items-center gap-1.5">
						<button
							onClick={toggleLock}
							title="锁定/穿透鼠标 (Ctrl+Alt+L 解锁)"
							className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
						>
							<Lock className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={handleClose}
							title="关闭桌面歌词"
							className="p-1 rounded hover:bg-red-500/80 text-white/70 hover:text-white transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			)}

			{/* Center: Syllable Lyric Text */}
			<div className="text-center space-y-1 pointer-events-none w-full max-w-2xl px-4">
				{activeLine ? (
					<>
						<p
							className="font-bold tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] leading-tight transition-all"
							style={{ fontSize: `${fontSize}px` }}
						>
							{activeLine.isDynamic &&
							activeLine.spans &&
							activeLine.spans.length > 0 ? (
								activeLine.spans.map((span, idx) => {
									let fillPct = 0
									if (currentTimeMs >= span.endTime) {
										fillPct = 100
									} else if (currentTimeMs > span.startTime) {
										fillPct = Math.min(
											100,
											((currentTimeMs - span.startTime) /
												(span.duration || 1)) *
												100,
										)
									}

									return (
										<span
											key={idx}
											className="inline-block transition-all duration-75"
											style={{
												background: `linear-gradient(to right, ${primaryColor} ${fillPct}%, rgba(255, 255, 255, 0.7) ${fillPct}%)`,
												WebkitBackgroundClip: 'text',
												WebkitTextFillColor: 'transparent',
											}}
										>
											{span.text}
										</span>
									)
								})
							) : (
								<span
									style={{ color: primaryColor }}
									className="drop-shadow-[0_2px_8px_rgba(0,174,236,0.6)]"
								>
									{activeLine.content}
								</span>
							)}
						</p>

						{/* Translation or subline */}
						{activeLine.translation && (
							<p className="text-xs text-white/75 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] truncate">
								{activeLine.translation}
							</p>
						)}
					</>
				) : (
					<div className="space-y-0.5">
						<p
							className="font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
							style={{ fontSize: `${fontSize}px` }}
						>
							{title}
						</p>
						<p className="text-xs text-white/60 font-medium">{artist}</p>
					</div>
				)}
			</div>
		</div>
	)
}
```

---

### 文件 11：`apps/desktop/src-tauri/src/shortcuts.rs`
* **修改说明**：
  1. 当触发 `"toggle_penetration"` 全局热键切换桌面歌词鼠标穿透时，除了调用 `lyrics_win.set_ignore_cursor_events(new_state)`，同时派发 `app.emit("lyrics-lock-change", new_state)` 通知 `DesktopLyricsApp.tsx` 更新 UI 锁定态。

```rust
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub id: String,          // e.g. "play_pause", "prev_track", "next_track", "toggle_lyrics", "toggle_penetration"
    pub key: String,         // e.g. "Ctrl+Alt+Space"
    pub description: String, // e.g. "播放 / 暂停"
}

pub static LYRICS_IGNORE_CURSOR: AtomicBool = AtomicBool::new(false);

pub fn get_default_shortcuts() -> Vec<ShortcutConfig> {
    vec![
        ShortcutConfig {
            id: "play_pause".into(),
            key: "Ctrl+Alt+Space".into(),
            description: "全局：播放 / 暂停".into(),
        },
        ShortcutConfig {
            id: "prev_track".into(),
            key: "Ctrl+Alt+ArrowLeft".into(),
            description: "全局：上一首".into(),
        },
        ShortcutConfig {
            id: "next_track".into(),
            key: "Ctrl+Alt+ArrowRight".into(),
            description: "全局：下一首".into(),
        },
        ShortcutConfig {
            id: "toggle_lyrics".into(),
            key: "Ctrl+Alt+D".into(),
            description: "全局：显示/隐藏桌面歌词".into(),
        },
        ShortcutConfig {
            id: "toggle_penetration".into(),
            key: "Ctrl+Alt+L".into(),
            description: "全局：切换歌词鼠标穿透".into(),
        },
    ]
}

static CURRENT_SHORTCUTS: std::sync::Mutex<Option<Vec<ShortcutConfig>>> =
    std::sync::Mutex::new(None);

/// 将前端键名标准化为 Tauri keyboard-types 规范格式
fn normalize_shortcut_key(raw: &str) -> String {
    raw.split('+')
        .map(|part| match part.trim() {
            "Left" | "left" => "ArrowLeft",
            "Right" | "right" => "ArrowRight",
            "Up" | "up" => "ArrowUp",
            "Down" | "down" => "ArrowDown",
            "Ctrl" | "ctrl" => "Control",
            other => other,
        })
        .collect::<Vec<_>>()
        .join("+")
}

/// 检查热键是否带有 Windows 系统级热键必需的修饰键
fn has_modifier(raw: &str) -> bool {
    let lower = raw.to_lowercase();
    lower.contains("alt+")
        || lower.contains("ctrl+")
        || lower.contains("control+")
        || lower.contains("shift+")
        || lower.contains("super+")
        || lower.contains("meta+")
        || lower.contains("commandorcontrol+")
}

pub fn register_all_shortcuts(app: &AppHandle, configs: &[ShortcutConfig]) {
    {
        let mut lock = CURRENT_SHORTCUTS.lock().unwrap();
        *lock = Some(configs.to_vec());
    }

    let global_shortcut = app.global_shortcut();
    let _ = global_shortcut.unregister_all();

    for cfg in configs {
        let key_str = cfg.key.trim();
        if key_str.is_empty() {
            continue;
        }

        // 不含修饰键的单键（如 Space）由前端窗口内 keydown 处理，不向 OS 注册全局热键避免 Windows RegisterHotKey 报错
        if !has_modifier(key_str) {
            continue;
        }

        let normalized = normalize_shortcut_key(key_str);
        if let Ok(shortcut) = normalized.parse::<Shortcut>() {
            let _ = global_shortcut.register(shortcut);
        }
    }
}

pub fn handle_shortcut_event(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
    if state != ShortcutState::Pressed {
        return;
    }

    let current_str = shortcut.to_string();

    // 在当前活跃配置或默认配置中匹配动作 ID
    let active_configs = {
        let lock = CURRENT_SHORTCUTS.lock().unwrap();
        lock.clone().unwrap_or_else(get_default_shortcuts)
    };

    let mut matched_id = None;
    for item in &active_configs {
        let normalized = normalize_shortcut_key(&item.key);
        if let Ok(s) = normalized.parse::<Shortcut>() {
            if shortcut == &s {
                matched_id = Some(item.id.clone());
                break;
            }
        }
    }

    let action_id = match matched_id {
        Some(ref id) => id.clone(),
        None => current_str,
    };

    match action_id.as_str() {
        "toggle_penetration" => {
            let new_state = !LYRICS_IGNORE_CURSOR.load(Ordering::SeqCst);
            LYRICS_IGNORE_CURSOR.store(new_state, Ordering::SeqCst);
            if let Some(lyrics_win) = app.get_webview_window("lyrics") {
                let _ = lyrics_win.set_ignore_cursor_events(new_state);
            }
            let _ = app.emit("lyrics-lock-change", new_state);
        }
        "toggle_lyrics" => {
            let _ = crate::window_ext::toggle_lyrics_window(app.clone());
        }
        _ => {}
    }

    // 1. 标准 Tauri IPC 事件派发
    let _ = app.emit("global-shortcut-event", &action_id);

    // 2. 双保险：直接在主窗口执行 window.__triggerGlobalShortcut，防止失焦时 Webview 事件被系统队列节流延迟
    if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(json_id) = serde_json::to_string(&action_id) {
            let script = format!(
                "if (window.__triggerGlobalShortcut) {{ window.__triggerGlobalShortcut({}); }}",
                json_id
            );
            let _ = main_win.eval(&script);
        }
    }
}

#[tauri::command]
pub fn get_shortcuts() -> Vec<ShortcutConfig> {
    let lock = CURRENT_SHORTCUTS.lock().unwrap();
    lock.clone().unwrap_or_else(get_default_shortcuts)
}

#[tauri::command]
pub fn update_shortcuts(app: AppHandle, configs: Vec<ShortcutConfig>) -> Result<(), String> {
    register_all_shortcuts(&app, &configs);
    Ok(())
}
```

---

### 文件 12：`apps/desktop/src-tauri/src/http_client.rs`
* **修改说明**：
  1. 在重定向循环中使用可变的 `current_method`。当遇到 `301`/`302`/`303` 重定向且原方法为 `POST` 时，按照 HTTP RFC 规范自动切换为 `GET`。
  2. 使用 `reqwest::Url::join` 解析相对重定向路径。

```rust
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, SET_COOKIE};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct NativeHttpRequest {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NativeHttpResponse {
    pub ok: bool,
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_reqwest_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        let mut builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            // 不自动跟随重定向，以便手动拦截捕获 302 跨域换票响应头中的 Set-Cookie
            .redirect(reqwest::redirect::Policy::none());

        if let Ok(proxy_val) = std::env::var("HTTP_PROXY").or_else(|_| std::env::var("http_proxy")) {
            if let Ok(proxy) = reqwest::Proxy::all(&proxy_val) {
                builder = builder.proxy(proxy);
            }
        }

        builder.build().unwrap_or_else(|_| reqwest::Client::new())
    })
}

#[tauri::command]
pub async fn native_http_request(request: NativeHttpRequest) -> Result<NativeHttpResponse, String> {
    let client = get_reqwest_client();
    let mut current_method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_uppercase();

    let mut current_url = request.url.clone();
    let mut all_set_cookies: Vec<String> = Vec::new();
    let mut redirect_count = 0;

    loop {
        let req_builder = match current_method.as_str() {
            "POST" => client.post(&current_url),
            "PUT" => client.put(&current_url),
            "DELETE" => client.delete(&current_url),
            "HEAD" => client.head(&current_url),
            _ => client.get(&current_url),
        };

        let mut header_map = HeaderMap::new();
        if let Some(ref headers) = request.headers {
            for (k, v) in headers {
                if let (Ok(hn), Ok(hv)) = (
                    HeaderName::from_bytes(k.as_bytes()),
                    HeaderValue::from_str(v),
                ) {
                    header_map.insert(hn, hv);
                }
            }
        }

        // 如果在前面的重定向跃点中捕获到了 Cookie，且当前请求未设置 Cookie，则自动透传
        if !all_set_cookies.is_empty() && !header_map.contains_key("cookie") {
            let cookie_parts: Vec<String> = all_set_cookies
                .iter()
                .filter_map(|c| c.split(';').next().map(|p| p.trim().to_string()))
                .collect();
            if !cookie_parts.is_empty() {
                if let Ok(cv) = HeaderValue::from_str(&cookie_parts.join("; ")) {
                    header_map.insert(HeaderName::from_static("cookie"), cv);
                }
            }
        }

        let mut req_builder = req_builder.headers(header_map);
        if redirect_count == 0 && current_method != "GET" && current_method != "HEAD" {
            if let Some(ref body_str) = request.body {
                req_builder = req_builder.body(body_str.clone());
            }
        }

        let response = req_builder.send().await.map_err(|e| e.to_string())?;
        let status = response.status();

        // 收集当前响应中的所有 Set-Cookie
        for val in response.headers().get_all(SET_COOKIE).iter() {
            if let Ok(val_str) = val.to_str() {
                all_set_cookies.push(val_str.to_string());
            }
        }

        // 手动处理 301/302/303/307/308 重定向，保留各级跃点的全部 Set-Cookie
        if status.is_redirection() && redirect_count < 5 {
            if let Some(loc) = response.headers().get(reqwest::header::LOCATION) {
                if let Ok(loc_str) = loc.to_str() {
                    current_url = if loc_str.starts_with("http://") || loc_str.starts_with("https://") {
                        loc_str.to_string()
                    } else if let Ok(base_url) = reqwest::Url::parse(&current_url) {
                        base_url
                            .join(loc_str)
                            .map(|u| u.to_string())
                            .unwrap_or_else(|_| loc_str.to_string())
                    } else {
                        loc_str.to_string()
                    };

                    // HTTP 标准：301/302/303 重定向时将 POST 转为 GET
                    if matches!(
                        status,
                        StatusCode::MOVED_PERMANENTLY
                            | StatusCode::FOUND
                            | StatusCode::SEE_OTHER
                    ) && current_method == "POST"
                    {
                        current_method = "GET".to_string();
                    }

                    redirect_count += 1;
                    continue;
                }
            }
        }

        let status_code = status.as_u16();
        let status_text = status.canonical_reason().unwrap_or("").to_string();
        let ok = status.is_success() || status.is_redirection();

        let mut resp_headers = HashMap::new();
        for (name, val) in response.headers().iter() {
            let name_str = name.as_str().to_lowercase();
            if name != SET_COOKIE {
                if let Ok(val_str) = val.to_str() {
                    resp_headers.insert(name_str, val_str.to_string());
                }
            }
        }

        if !all_set_cookies.is_empty() {
            // 使用换行符分隔不同的 Set-Cookie，防止与单个 Cookie 内的 ';' 混淆
            resp_headers.insert("set-cookie".to_string(), all_set_cookies.join("\n"));
        }

        let body = response.text().await.map_err(|e| e.to_string())?;

        return Ok(NativeHttpResponse {
            ok,
            status: status_code,
            status_text,
            headers: resp_headers,
            body,
        });
    }
}
```