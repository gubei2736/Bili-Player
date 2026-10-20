import type { Track } from '@bbplayer/shared-core'
import { logDebug, logError, logMultipart } from '../utils/debugLogger'
import {
	getEqualizerSettings,
	EQ_FREQUENCIES,
	type EqualizerSettings,
} from './equalizerSettings'

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
	getVolume(): number
	isMuted(): boolean
	setMuted(muted: boolean): void
	setLoudnessNormalization(enabled: boolean): void
	getFrequencyData(buffer: Uint8Array): void
	getCurrentTime(): number
	getDuration(): number
	isPlaying(): boolean
}

export type PlaybackListener = (event: {
	type:
		| 'timeupdate'
		| 'play'
		| 'pause'
		| 'ended'
		| 'error'
		| 'loadedmetadata'
		| 'trackchange'
	currentTime: number
	duration: number
	track?: Track | null
}) => void

export interface AudioSlot {
	id: number
	audio: HTMLAudioElement
	sourceNode: MediaElementAudioSourceNode | null
	fadeGainNode: GainNode | null
	track: Track | null
	proxyStreamUrl: string | null
	loudnessGainDb: number
	isPreloaded: boolean
}

export class DesktopAudioEngine implements AudioEngineContract {
	// 双 Audio 乒乓缓冲池 (Slot 0 和 Slot 1)
	private slots: [AudioSlot, AudioSlot]
	private activeSlotIndex = 0

	private audioCtx: AudioContext | null = null
	private eqInputNode: GainNode | null = null

	// 耳机声场防疲劳 Crossfeed 节点
	private crossfeedDryNode: GainNode | null = null
	private crossfeedWetNode: GainNode | null = null
	private crossfeedOutputNode: GainNode | null = null

	// 10 段参数化 EQ 滤波器
	private eqFilterNodes: BiquadFilterNode[] = []

	// 人声增强滤镜节点 (Mid 提升 + Low 削弱防浑浊 + High 泛音)
	private vocalFilterMid: BiquadFilterNode | null = null
	private vocalFilterLow: BiquadFilterNode | null = null
	private vocalFilterHigh: BiquadFilterNode | null = null

	// EBU R128 响度增益节点与防削波限制器
	private gainNode: GainNode | null = null
	private compressorNode: DynamicsCompressorNode | null = null
	private analyserNode: AnalyserNode | null = null

	private currentTrack: Track | null = null
	private loudnessNormalizationEnabled = false
	private currentLoudnessGainDb = 0
	private listeners: Set<PlaybackListener> = new Set()

	private currentVolume = 0.5
	private currentMuted = false

	// 淡出防重计时器
	private crossfadeCleanupTimer: any = null
	private pauseTimer: any = null
	private isSwitchingTrack = false

	constructor() {
		try {
			const savedVol = localStorage.getItem('bbplayer_volume')
			this.currentVolume =
				savedVol !== null ? Math.max(0, Math.min(1, parseFloat(savedVol))) : 0.5
		} catch {
			this.currentVolume = 0.5
		}

		try {
			const saved = localStorage.getItem('bbplayer_audio_volume_balance')
			this.loudnessNormalizationEnabled = saved === 'true'
		} catch {
			this.loudnessNormalizationEnabled = false
		}

		// 创建两个独立的 Audio 槽位
		this.slots = [this.createSlot(0), this.createSlot(1)]
		this.setupSlotEventListeners(this.slots[0])
		this.setupSlotEventListeners(this.slots[1])

		// 监听均衡器配置变动事件
		if (typeof window !== 'undefined') {
			window.addEventListener('bbplayer:equalizer-changed', ((e: CustomEvent) => {
				this.updateEqualizer(e.detail)
			}) as EventListener)
		}
	}

	private createSlot(id: number): AudioSlot {
		const audio = new Audio()
		audio.crossOrigin = 'anonymous'
		audio.volume = this.currentVolume
		audio.muted = this.currentMuted
		return {
			id,
			audio,
			sourceNode: null,
			fadeGainNode: null,
			track: null,
			proxyStreamUrl: null,
			loudnessGainDb: 0,
			isPreloaded: false,
		}
	}

	public get activeSlot(): AudioSlot {
		return this.slots[this.activeSlotIndex]
	}

	public get idleSlot(): AudioSlot {
		return this.slots[1 - this.activeSlotIndex]
	}

	public get activeAudio(): HTMLAudioElement {
		return this.slots[this.activeSlotIndex].audio
	}

	private initAudioContext(): void {
		if (this.audioCtx) return

		const AudioCtxClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext
		this.audioCtx = new AudioCtxClass()

		// 1. 初始化双 Audio 槽位的 MediaElementSourceNode 与独立的 FadeGainNode
		for (let i = 0; i < 2; i++) {
			const slot = this.slots[i]
			if (!slot.sourceNode) {
				slot.sourceNode = this.audioCtx.createMediaElementSource(slot.audio)
				slot.fadeGainNode = this.audioCtx.createGain()
				// 当前活跃槽位初始音量为 1.0，闲置槽位为 0.0
				slot.fadeGainNode.gain.setValueAtTime(
					i === this.activeSlotIndex ? 1.0 : 0.0,
					this.audioCtx.currentTime,
				)
				slot.sourceNode.connect(slot.fadeGainNode)
			}
		}

		// 2. EQ 输入汇总节点 (两个槽位的音频汇流于此)
		this.eqInputNode = this.audioCtx.createGain()
		this.slots[0].fadeGainNode!.connect(this.eqInputNode)
		this.slots[1].fadeGainNode!.connect(this.eqInputNode)

		// 3. 构建 Crossfeed 耳机立体声声场交叉网络
		this.crossfeedDryNode = this.audioCtx.createGain()
		this.crossfeedWetNode = this.audioCtx.createGain()
		this.crossfeedOutputNode = this.audioCtx.createGain()

		// 3.1 干声通道 (直接直通)
		this.eqInputNode.connect(this.crossfeedDryNode)
		this.crossfeedDryNode.connect(this.crossfeedOutputNode)

		// 3.2 湿声通道 (耳旁交叉延迟滤波网络)
		const splitter = this.audioCtx.createChannelSplitter(2)
		const merger = this.audioCtx.createChannelMerger(2)
		this.eqInputNode.connect(this.crossfeedWetNode)
		this.crossfeedWetNode.connect(splitter)

		const lDirect = this.audioCtx.createGain()
		const rDirect = this.audioCtx.createGain()
		const lToRFilter = this.audioCtx.createBiquadFilter()
		const rToLFilter = this.audioCtx.createBiquadFilter()
		const lToRDelay = this.audioCtx.createDelay(0.01)
		const rToLDelay = this.audioCtx.createDelay(0.01)
		const lToRGain = this.audioCtx.createGain()
		const rToLGain = this.audioCtx.createGain()

		lToRFilter.type = 'lowpass'
		lToRFilter.frequency.setValueAtTime(750, this.audioCtx.currentTime)
		rToLFilter.type = 'lowpass'
		rToLFilter.frequency.setValueAtTime(750, this.audioCtx.currentTime)
		lToRDelay.delayTime.setValueAtTime(0.0003, this.audioCtx.currentTime)
		rToLDelay.delayTime.setValueAtTime(0.0003, this.audioCtx.currentTime)
		lToRGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime)
		rToLGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime)

		// 左声道：直通左耳，滤波延迟微馈到右耳
		splitter.connect(lDirect, 0)
		lDirect.connect(merger, 0, 0)
		splitter.connect(lToRFilter, 0)
		lToRFilter.connect(lToRDelay)
		lToRDelay.connect(lToRGain)
		lToRGain.connect(merger, 0, 1)

		// 右声道：直通右耳，滤波延迟微馈到左耳
		splitter.connect(rDirect, 1)
		rDirect.connect(merger, 0, 1)
		splitter.connect(rToLFilter, 1)
		rToLFilter.connect(rToLDelay)
		rToLDelay.connect(rToLGain)
		rToLGain.connect(merger, 0, 0)

		merger.connect(this.crossfeedOutputNode)

		// 4. 构建 10 段参数化 EQ 滤波器链路
		this.eqFilterNodes = EQ_FREQUENCIES.map((freq, idx) => {
			const filter = this.audioCtx!.createBiquadFilter()
			if (idx === 0) {
				filter.type = 'lowshelf'
			} else if (idx === EQ_FREQUENCIES.length - 1) {
				filter.type = 'highshelf'
			} else {
				filter.type = 'peaking'
				filter.Q.setValueAtTime(1.4, this.audioCtx!.currentTime)
			}
			filter.frequency.setValueAtTime(freq, this.audioCtx!.currentTime)
			filter.gain.setValueAtTime(0, this.audioCtx!.currentTime)
			return filter
		})

		// 5. 构建人声增强专职滤镜 (Mid Peak 突出 + Low Shelf 去浑浊 + High Shelf 空气感)
		this.vocalFilterMid = this.audioCtx.createBiquadFilter()
		this.vocalFilterMid.type = 'peaking'
		this.vocalFilterMid.frequency.setValueAtTime(2200, this.audioCtx.currentTime)
		this.vocalFilterMid.Q.setValueAtTime(1.2, this.audioCtx.currentTime)
		this.vocalFilterMid.gain.setValueAtTime(0, this.audioCtx.currentTime)

		this.vocalFilterLow = this.audioCtx.createBiquadFilter()
		this.vocalFilterLow.type = 'lowshelf'
		this.vocalFilterLow.frequency.setValueAtTime(160, this.audioCtx.currentTime)
		this.vocalFilterLow.gain.setValueAtTime(0, this.audioCtx.currentTime)

		this.vocalFilterHigh = this.audioCtx.createBiquadFilter()
		this.vocalFilterHigh.type = 'highshelf'
		this.vocalFilterHigh.frequency.setValueAtTime(6500, this.audioCtx.currentTime)
		this.vocalFilterHigh.gain.setValueAtTime(0, this.audioCtx.currentTime)

		// 6. 串联 EQ 与人声增强滤镜
		let lastNode: AudioNode = this.crossfeedOutputNode
		for (const filter of this.eqFilterNodes) {
			lastNode.connect(filter)
			lastNode = filter
		}
		lastNode.connect(this.vocalFilterMid)
		this.vocalFilterMid.connect(this.vocalFilterLow)
		this.vocalFilterLow.connect(this.vocalFilterHigh)
		lastNode = this.vocalFilterHigh

		// 7. GainNode (EBU R128 响度均衡前置增益)
		this.gainNode = this.audioCtx.createGain()
		lastNode.connect(this.gainNode)

		// 8. DynamicsCompressorNode (专业广播级透明防削波母带限制器 - 消除抽吸感)
		this.compressorNode = this.audioCtx.createDynamicsCompressor()
		this.compressorNode.threshold.setValueAtTime(-2.0, this.audioCtx.currentTime)
		this.compressorNode.knee.setValueAtTime(6.0, this.audioCtx.currentTime)
		this.compressorNode.ratio.setValueAtTime(12.0, this.audioCtx.currentTime)
		this.compressorNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime)
		this.compressorNode.release.setValueAtTime(0.20, this.audioCtx.currentTime)
		this.gainNode.connect(this.compressorNode)

		// 9. AnalyserNode (FFT 频谱分析与实时 RMS 响度感知)
		this.analyserNode = this.audioCtx.createAnalyser()
		this.analyserNode.fftSize = 256
		this.analyserNode.smoothingTimeConstant = 0.8
		this.compressorNode.connect(this.analyserNode)

		// 10. 输出到最终系统声卡
		this.analyserNode.connect(this.audioCtx.destination)

		// 11. 立即载入并应用保存的 EQ 与人声增强配置
		this.updateEqualizer()
	}

	public updateEqualizer(settings?: EqualizerSettings): void {
		const s = settings || getEqualizerSettings()
		if (!this.audioCtx) return

		const now = this.audioCtx.currentTime

		// 1. Crossfeed 旁通与启用平滑切换
		if (this.crossfeedDryNode && this.crossfeedWetNode) {
			if (s.crossfeedEnabled) {
				this.crossfeedDryNode.gain.setTargetAtTime(0.0, now, 0.03)
				this.crossfeedWetNode.gain.setTargetAtTime(1.0, now, 0.03)
			} else {
				this.crossfeedDryNode.gain.setTargetAtTime(1.0, now, 0.03)
				this.crossfeedWetNode.gain.setTargetAtTime(0.0, now, 0.03)
			}
		}

		// 2. 10 段 EQ 增益设置
		if (this.eqFilterNodes && this.eqFilterNodes.length === 10) {
			this.eqFilterNodes.forEach((node, idx) => {
				const gain = s.enabled ? (s.gains[idx] ?? 0) : 0
				node.gain.setTargetAtTime(gain, now, 0.03)
			})
		}

		// 3. 人声增强滤镜
		if (this.vocalFilterMid && this.vocalFilterLow && this.vocalFilterHigh) {
			const vocalActive = s.vocalEnhancerEnabled
			const intensity = s.vocalEnhancerIntensity || 3.5
			this.vocalFilterMid.gain.setTargetAtTime(
				vocalActive ? intensity : 0,
				now,
				0.03,
			)
			this.vocalFilterLow.gain.setTargetAtTime(
				vocalActive ? -2.5 : 0,
				now,
				0.03,
			)
			this.vocalFilterHigh.gain.setTargetAtTime(
				vocalActive ? 2.0 : 0,
				now,
				0.03,
			)
		}
	}

	private setupSlotEventListeners(slot: AudioSlot): void {
		const { audio, id } = slot

		audio.addEventListener('loadstart', () => {
			if (this.activeSlotIndex === id) {
				logDebug('AudioEngine', `[Slot ${id}] 开始请求音频资源`, {
					src: audio.src.substring(0, 100),
					networkState: audio.networkState,
				})
			}
		})

		audio.addEventListener('loadedmetadata', () => {
			if (this.activeSlotIndex === id) {
				logDebug('AudioEngine', `[Slot ${id}] 元数据已加载`, {
					duration: audio.duration,
					readyState: audio.readyState,
				})
				this.emit({
					type: 'loadedmetadata',
					currentTime: this.getCurrentTime(),
					duration: this.getDuration(),
					track: this.currentTrack,
				})
			}
		})

		audio.addEventListener('canplay', () => {
			slot.isPreloaded = true
			if (this.activeSlotIndex === id) {
				logDebug('AudioEngine', `[Slot ${id}] 音频数据就绪可播放`, {
					readyState: audio.readyState,
					duration: audio.duration,
				})
			} else {
				logDebug('AudioEngine', `[Slot ${id}] 预热音频就绪，随时可 0ms 秒切`)
			}
		})

		audio.addEventListener('playing', () => {
			if (this.activeSlotIndex === id) {
				logDebug('AudioEngine', `[Slot ${id}] 音频正在出声播放`, {
					currentTime: audio.currentTime,
				})
			}
		})

		audio.addEventListener('waiting', () => {
			if (this.activeSlotIndex === id) {
				logDebug('AudioEngine', `[Slot ${id}] 正在缓冲后续数据帧...`)
			}
		})

		audio.addEventListener('play', () => {
			this.isSwitchingTrack = false
			if (this.activeSlotIndex === id) {
				if ('mediaSession' in navigator) {
					navigator.mediaSession.playbackState = 'playing'
				}
				this.emit({
					type: 'play',
					currentTime: this.getCurrentTime(),
					duration: this.getDuration(),
					track: this.currentTrack,
				})
			}
		})

		audio.addEventListener('pause', () => {
			// 切歌过程中旧槽位静默暂停，绝不向外部广播假的 pause 事件
			if (this.isSwitchingTrack) {
				logDebug('AudioEngine', `[Slot ${id}] 切歌过渡期静音暂停旧槽位，静默处理不派发全局 pause 事件`)
				return
			}
			if (this.activeSlotIndex === id) {
				if ('mediaSession' in navigator) {
					navigator.mediaSession.playbackState = 'paused'
				}
				this.emit({
					type: 'pause',
					currentTime: this.getCurrentTime(),
					duration: this.getDuration(),
					track: this.currentTrack,
				})
			}
		})

		audio.addEventListener('timeupdate', () => {
			if (this.activeSlotIndex === id) {
				if ('mediaSession' in navigator && !isNaN(audio.duration)) {
					try {
						navigator.mediaSession.setPositionState({
							duration: audio.duration || 0,
							playbackRate: audio.playbackRate || 1,
							position: Math.min(audio.currentTime || 0, audio.duration || 0),
						})
					} catch {}
				}
				this.emit({
					type: 'timeupdate',
					currentTime: this.getCurrentTime(),
					duration: this.getDuration(),
					track: this.currentTrack,
				})
			}
		})

		audio.addEventListener('ended', () => {
			if (this.activeSlotIndex === id) {
				this.emit({
					type: 'ended',
					currentTime: this.getCurrentTime(),
					duration: this.getDuration(),
					track: this.currentTrack,
				})
			}
		})

		audio.addEventListener('error', () => {
			if (this.activeSlotIndex === id) {
				const err = audio.error
				const errMap: Record<number, string> = {
					1: 'MEDIA_ERR_ABORTED (用户或程序中止获取)',
					2: 'MEDIA_ERR_NETWORK (网络连接中断或代理阻断)',
					3: 'MEDIA_ERR_DECODE (媒体解码失败，格式或编码损坏)',
					4: 'MEDIA_ERR_SRC_NOT_SUPPORTED (音频格式不受支持或资源不可达 403/404/502)',
				}
				const reason = err
					? errMap[err.code] || `Error Code ${err.code}`
					: 'Unknown Error'
				logError(
					'AudioEngine',
					`HTMLAudioElement 播放发生错误: ${reason} (code: ${err?.code})`,
					{
						src: audio.src,
						trackTitle: this.currentTrack?.title,
					},
				)
				this.emit({
					type: 'error',
					currentTime: this.getCurrentTime(),
					duration: this.getDuration(),
					track: this.currentTrack,
				})
			}
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
				album: 'Bili Player',
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
		this.listeners.forEach((listener) => {
			try {
				listener(event)
			} catch (err) {
				logError(
					'AudioEngine',
					'PlaybackListener 监听器执行异常，已安全隔离以防止中断播放主链路',
					err,
				)
			}
		})
	}

	public subscribe(listener: PlaybackListener): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	public setActiveTrack(track: Track): void {
		logMultipart('AudioEngine', 'setActiveTrack 被调用', {
			uniqueKey: track.uniqueKey,
			title: track.title,
			pageIndex: (track as any)?.bilibiliMetadata?.pageIndex,
			cid: (track as any)?.bilibiliMetadata?.cid,
		})
		this.currentTrack = track
		this.updateMediaSession(track)
		this.emit({
			type: 'trackchange',
			currentTime: this.getCurrentTime(),
			duration: track.duration || this.getDuration(),
			track,
		})
	}

	/**
	 * 在准备切歌时调用：以柔和的 120ms 软淡出上一首，杜绝音爆与刺耳截断
	 */
	public prepareTrackSwitch(track?: Track): void {
		this.isSwitchingTrack = true
		logDebug('AudioEngine', 'prepareTrackSwitch 准备切歌', {
			targetTrack: track?.title,
			uniqueKey: track?.uniqueKey,
			activeSlotIndex: this.activeSlotIndex,
			isPlaying: this.isPlaying(),
		})

		if (this.crossfadeCleanupTimer) {
			clearTimeout(this.crossfadeCleanupTimer)
			this.crossfadeCleanupTimer = null
		}
		if (this.pauseTimer) {
			clearTimeout(this.pauseTimer)
			this.pauseTimer = null
		}

		const activeSlot = this.activeSlot
		if (this.audioCtx && activeSlot.fadeGainNode && this.isPlaying()) {
			const now = this.audioCtx.currentTime
			activeSlot.fadeGainNode.gain.cancelScheduledValues(now)
			activeSlot.fadeGainNode.gain.setValueAtTime(activeSlot.fadeGainNode.gain.value, now)
			activeSlot.fadeGainNode.gain.setTargetAtTime(0.0001, now, 0.02)
		}
		try {
			activeSlot.audio.pause()
		} catch {}

		if (track) {
			this.currentTrack = track
			this.updateMediaSession(track)
			this.emit({
				type: 'trackchange',
				currentTime: 0,
				duration: track.duration || 0,
				track,
			})
		}
	}

	/**
	 * 后台静默预加载下一首歌曲到闲置 Audio 槽位（实现 0ms 秒切无缝播放）
	 */
	public preloadNextTrack(
		track: Track,
		proxyStreamUrl: string,
		loudnessGainDb = 0,
	): void {
		const idleSlot = this.idleSlot
		if (idleSlot.proxyStreamUrl === proxyStreamUrl && idleSlot.isPreloaded) {
			return
		}

		logDebug(
			'AudioEngine',
			`[乒乓缓冲池] 闲置槽位 Slot ${idleSlot.id} 开始预热下一曲: ${track.title}`,
		)
		idleSlot.track = track
		idleSlot.proxyStreamUrl = proxyStreamUrl
		idleSlot.loudnessGainDb = loudnessGainDb
		idleSlot.isPreloaded = false

		idleSlot.audio.src = proxyStreamUrl
		idleSlot.audio.load()

		if (idleSlot.fadeGainNode && this.audioCtx) {
			idleSlot.fadeGainNode.gain.cancelScheduledValues(
				this.audioCtx.currentTime,
			)
			idleSlot.fadeGainNode.gain.setValueAtTime(
				0.0,
				this.audioCtx.currentTime,
			)
		}
	}

	public async loadAndPlay(
		track: Track,
		proxyStreamUrl: string,
		loudnessGainDb = 0,
	): Promise<void> {
		logMultipart('AudioEngine', 'loadAndPlay 开始执行', {
			uniqueKey: track.uniqueKey,
			title: track.title,
			pageIndex: (track as any)?.bilibiliMetadata?.pageIndex,
			cid: (track as any)?.bilibiliMetadata?.cid,
			proxyStreamUrl: proxyStreamUrl.substring(0, 80) + '...',
		})

		this.initAudioContext()
		if (this.audioCtx?.state === 'suspended') {
			await this.audioCtx.resume()
		}

		if (this.crossfadeCleanupTimer) {
			clearTimeout(this.crossfadeCleanupTimer)
			this.crossfadeCleanupTimer = null
		}
		if (this.pauseTimer) {
			clearTimeout(this.pauseTimer)
			this.pauseTimer = null
		}

		const eq = getEqualizerSettings()
		const prevSlot = this.slots[this.activeSlotIndex]
		const isSameTrack =
			prevSlot.track?.uniqueKey === track.uniqueKey &&
			prevSlot.proxyStreamUrl === proxyStreamUrl

		// 双 Audio 乒乓切换：只要不是同一首歌曲，始终切到另一个槽位
		let targetSlot: AudioSlot
		if (!isSameTrack) {
			targetSlot = this.slots[1 - this.activeSlotIndex]
			this.activeSlotIndex = targetSlot.id
		} else {
			targetSlot = prevSlot
		}

		// 判断是否可交叉淡入淡出 (旧音频在出声且与新音频不是同一槽位)
		const canCrossfade =
			eq.crossfadeEnabled &&
			prevSlot.id !== targetSlot.id &&
			prevSlot.audio.currentTime > 0 &&
			!prevSlot.audio.ended

		const crossfadeDuration = canCrossfade
			? Math.max(0.3, Math.min(3.5, eq.crossfadeDuration || 1.2))
			: 0.12

		this.currentTrack = track
		this.currentLoudnessGainDb = loudnessGainDb
		targetSlot.track = track
		targetSlot.loudnessGainDb = loudnessGainDb

		// 广播 trackchange，立刻更新 UI 视图
		this.emit({
			type: 'trackchange',
			currentTime: 0,
			duration: track.duration || this.getDuration(),
			track,
		})

		// 赋值音频地址
		const isTargetSameSrc = targetSlot.audio.src === proxyStreamUrl
		if (!isTargetSameSrc) {
			targetSlot.audio.src = proxyStreamUrl
			targetSlot.proxyStreamUrl = proxyStreamUrl
			targetSlot.isPreloaded = false
		} else if (targetSlot.audio.ended) {
			targetSlot.audio.currentTime = 0
		}

		this.applyLoudnessGain()
		this.updateMediaSession(track)

		try {
			// 执行交叉淡入淡出或切歌调度
			if (canCrossfade && this.audioCtx && prevSlot.fadeGainNode && targetSlot.fadeGainNode) {
				logDebug('AudioEngine', `[Crossfade] 启动平滑交叉淡入淡出，时长: ${crossfadeDuration}s`)

				const t0 = this.audioCtx.currentTime
				// 1. 旧歌曲平滑淡出
				prevSlot.fadeGainNode.gain.cancelScheduledValues(t0)
				prevSlot.fadeGainNode.gain.setValueAtTime(prevSlot.fadeGainNode.gain.value, t0)
				prevSlot.fadeGainNode.gain.setTargetAtTime(0.0001, t0, crossfadeDuration / 3)

				// 2. 新歌曲初始静音准备淡入
				targetSlot.fadeGainNode.gain.cancelScheduledValues(t0)
				targetSlot.fadeGainNode.gain.setValueAtTime(0.0001, t0)

				await targetSlot.audio.play()

				// 3. 播放启动后，基于当前实时 currentTime 触发平滑淡入
				const t1 = this.audioCtx.currentTime
				targetSlot.fadeGainNode.gain.cancelScheduledValues(t1)
				targetSlot.fadeGainNode.gain.setValueAtTime(Math.max(0.0001, targetSlot.fadeGainNode.gain.value), t1)
				targetSlot.fadeGainNode.gain.setTargetAtTime(1.0, t1, crossfadeDuration / 3)

				this.crossfadeCleanupTimer = setTimeout(() => {
					try {
						prevSlot.audio.pause()
						prevSlot.audio.currentTime = 0
						prevSlot.isPreloaded = false
						if (this.audioCtx && prevSlot.fadeGainNode) {
							const tEnd = this.audioCtx.currentTime
							prevSlot.fadeGainNode.gain.cancelScheduledValues(tEnd)
							prevSlot.fadeGainNode.gain.setValueAtTime(0.0, tEnd)
						}
					} catch {}
				}, crossfadeDuration * 1000 + 50)
			} else {
				// 普通切歌：旧槽位安全暂停停播
				if (prevSlot.id !== targetSlot.id) {
					try {
						prevSlot.audio.pause()
						prevSlot.audio.currentTime = 0
						prevSlot.isPreloaded = false
						if (this.audioCtx && prevSlot.fadeGainNode) {
							const tPrev = this.audioCtx.currentTime
							prevSlot.fadeGainNode.gain.cancelScheduledValues(tPrev)
							prevSlot.fadeGainNode.gain.setValueAtTime(0.0, tPrev)
						}
					} catch {}
				}

				// 新槽位起播
				if (this.audioCtx && targetSlot.fadeGainNode) {
					const tStart = this.audioCtx.currentTime
					targetSlot.fadeGainNode.gain.cancelScheduledValues(tStart)
					targetSlot.fadeGainNode.gain.setValueAtTime(0.01, tStart)

					await targetSlot.audio.play()

					const tPlay = this.audioCtx.currentTime
					targetSlot.fadeGainNode.gain.cancelScheduledValues(tPlay)
					targetSlot.fadeGainNode.gain.setValueAtTime(Math.max(0.01, targetSlot.fadeGainNode.gain.value), tPlay)
					targetSlot.fadeGainNode.gain.setTargetAtTime(1.0, tPlay, 0.04)
				} else {
					await targetSlot.audio.play()
				}
			}

			this.isSwitchingTrack = false
			logDebug('AudioEngine', 'audio.play() 启动成功，播放器进入播放状态', {
				activeSlotIndex: this.activeSlotIndex,
				title: track.title,
				audioCurrentTime: targetSlot.audio.currentTime,
			})
		} catch (playErr) {
			this.isSwitchingTrack = false
			logError('AudioEngine', `audio.play() 启动失败: ${track.title}`, playErr)
			throw playErr
		}

		logDebug('AudioEngine', 'audio.play() 启动成功，播放器进入播放状态')
	}

	private applyLoudnessGain(): void {
		if (!this.gainNode || !this.audioCtx) return

		let linearGain = 1.0
		if (this.loudnessNormalizationEnabled) {
			if (this.currentLoudnessGainDb !== 0) {
				const clampedDb = Math.max(-7, Math.min(6, this.currentLoudnessGainDb))
				linearGain = Math.pow(10, clampedDb / 20)
			}
			if (this.compressorNode) {
				this.compressorNode.threshold.setTargetAtTime(-2.0, this.audioCtx.currentTime, 0.05)
				this.compressorNode.knee.setTargetAtTime(6.0, this.audioCtx.currentTime, 0.05)
				this.compressorNode.ratio.setTargetAtTime(12.0, this.audioCtx.currentTime, 0.05)
			}
		} else {
			if (this.compressorNode) {
				this.compressorNode.threshold.setTargetAtTime(0, this.audioCtx.currentTime, 0.05)
				this.compressorNode.ratio.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.05)
			}
		}

		this.gainNode.gain.setTargetAtTime(linearGain, this.audioCtx.currentTime, 0.12)
	}

	/**
	 * 软恢复播放 (带 120ms 平滑淡入，彻底消灭突然出声的听觉冲击)
	 */
	public async play(): Promise<void> {
		if (this.pauseTimer) {
			clearTimeout(this.pauseTimer)
			this.pauseTimer = null
		}
		if (this.audioCtx?.state === 'suspended') {
			await this.audioCtx.resume()
		}
		const active = this.activeSlot
		if (active.audio.ended) {
			active.audio.currentTime = 0
		}

		if (this.audioCtx && active.fadeGainNode) {
			const tStart = this.audioCtx.currentTime
			active.fadeGainNode.gain.cancelScheduledValues(tStart)
			active.fadeGainNode.gain.setValueAtTime(0.0001, tStart)

			await active.audio.play()

			const tPlay = this.audioCtx.currentTime
			active.fadeGainNode.gain.cancelScheduledValues(tPlay)
			active.fadeGainNode.gain.setValueAtTime(0.0001, tPlay)
			active.fadeGainNode.gain.setTargetAtTime(1.0, tPlay, 0.04)
		} else {
			await active.audio.play()
		}
	}

	/**
	 * 软暂停 (带 80ms 柔和淡出，彻底消灭骤停爆音)
	 */
	public pause(): void {
		if (this.pauseTimer) {
			clearTimeout(this.pauseTimer)
			this.pauseTimer = null
		}

		const active = this.activeSlot
		if (!this.audioCtx || !active.fadeGainNode) {
			active.audio.pause()
			this.emit({
				type: 'pause',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
				track: this.currentTrack,
			})
			return
		}

		const now = this.audioCtx.currentTime
		active.fadeGainNode.gain.cancelScheduledValues(now)
		active.fadeGainNode.gain.setValueAtTime(active.fadeGainNode.gain.value, now)
		active.fadeGainNode.gain.setTargetAtTime(0.0001, now, 0.02)

		this.pauseTimer = setTimeout(() => {
			active.audio.pause()
			if (this.audioCtx && active.fadeGainNode) {
				const tEnd = this.audioCtx.currentTime
				active.fadeGainNode.gain.cancelScheduledValues(tEnd)
				active.fadeGainNode.gain.setValueAtTime(0.0001, tEnd)
			}
			this.emit({
				type: 'pause',
				currentTime: this.getCurrentTime(),
				duration: this.getDuration(),
				track: this.currentTrack,
			})
			this.pauseTimer = null
		}, 80)
	}

	public stop(): void {
		if (this.pauseTimer) {
			clearTimeout(this.pauseTimer)
			this.pauseTimer = null
		}
		for (const slot of this.slots) {
			slot.audio.pause()
			slot.audio.currentTime = 0
			slot.audio.removeAttribute('src')
			slot.track = null
			slot.isPreloaded = false
			if (this.audioCtx && slot.fadeGainNode) {
				const now = this.audioCtx.currentTime
				slot.fadeGainNode.gain.cancelScheduledValues(now)
				slot.fadeGainNode.gain.setValueAtTime(0.0001, now)
			}
		}
		this.currentTrack = null
	}

	public seek(timeInSeconds: number): void {
		if (isFinite(timeInSeconds)) {
			this.activeAudio.currentTime = Math.max(0, timeInSeconds)
		}
	}

	public setVolume(volume: number): void {
		const clamped = Math.max(0, Math.min(1, volume))
		this.currentVolume = clamped
		for (const slot of this.slots) {
			slot.audio.volume = clamped
		}
		try {
			localStorage.setItem('bbplayer_volume', clamped.toString())
		} catch {}
	}

	public getVolume(): number {
		return this.activeAudio.volume ?? this.currentVolume
	}

	public isMuted(): boolean {
		return this.activeAudio.muted ?? this.currentMuted
	}

	public setMuted(muted: boolean): void {
		this.currentMuted = muted
		for (const slot of this.slots) {
			slot.audio.muted = muted
		}
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
		return this.activeAudio.currentTime || 0
	}

	public getDuration(): number {
		return this.activeAudio.duration || 0
	}

	public isPlaying(): boolean {
		return !this.activeAudio.paused && !this.activeAudio.ended
	}

	public hasLoadedSource(): boolean {
		return Boolean(
			this.activeAudio.src &&
				this.activeAudio.src !== '' &&
				this.activeAudio.readyState > 0,
		)
	}

	public getCurrentTrack(): Track | null {
		return this.currentTrack
	}
}

export const desktopAudioEngine = new DesktopAudioEngine()
