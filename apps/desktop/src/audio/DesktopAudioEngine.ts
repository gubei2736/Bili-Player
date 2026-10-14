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
						position: Math.min(this.audio.currentTime || 0, this.audio.duration || 0),
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