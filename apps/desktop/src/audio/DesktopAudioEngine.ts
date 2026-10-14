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

		// 3. DynamicsCompressorNode (防爆音动态压缩)
		this.compressorNode = this.audioCtx.createDynamicsCompressor()
		this.compressorNode.threshold.setValueAtTime(-12, this.audioCtx.currentTime)
		this.compressorNode.knee.setValueAtTime(30, this.audioCtx.currentTime)
		this.compressorNode.ratio.setValueAtTime(12, this.audioCtx.currentTime)
		this.compressorNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime)
		this.compressorNode.release.setValueAtTime(0.25, this.audioCtx.currentTime)

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
			this.emit({ type: 'play', currentTime: this.getCurrentTime(), duration: this.getDuration() })
		})

		this.audio.addEventListener('pause', () => {
			this.emit({ type: 'pause', currentTime: this.getCurrentTime(), duration: this.getDuration() })
		})

		this.audio.addEventListener('timeupdate', () => {
			this.emit({ type: 'timeupdate', currentTime: this.getCurrentTime(), duration: this.getDuration() })
		})

		this.audio.addEventListener('ended', () => {
			this.emit({ type: 'ended', currentTime: this.getCurrentTime(), duration: this.getDuration() })
		})

		this.audio.addEventListener('loadedmetadata', () => {
			this.emit({ type: 'loadedmetadata', currentTime: this.getCurrentTime(), duration: this.getDuration() })
		})
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

		this.currentTrack = track
		this.currentLoudnessGainDb = loudnessGainDb

		this.audio.src = proxyStreamUrl
		this.applyLoudnessGain()

		await this.audio.play()
	}

	private applyLoudnessGain(): void {
		if (!this.gainNode || !this.audioCtx) return

		let linearGain = 1.0
		if (this.loudnessNormalizationEnabled && this.currentLoudnessGainDb !== 0) {
			// 响度均衡公式: gain = 10^(ΔL / 20)
			linearGain = Math.pow(10, this.currentLoudnessGainDb / 20)
		}

		this.gainNode.gain.setTargetAtTime(
			linearGain,
			this.audioCtx.currentTime,
			0.015,
		)
	}

	public async play(): Promise<void> {
		if (this.audioCtx?.state === 'suspended') {
			await this.audioCtx.resume()
		}
		await this.audio.play()
	}

	public pause(): void {
		this.audio.pause()
	}

	public seek(timeInSeconds: number): void {
		if (isFinite(timeInSeconds)) {
			this.audio.currentTime = timeInSeconds
		}
	}

	public setVolume(volume: number): void {
		this.audio.volume = Math.max(0, Math.min(1, volume))
	}

	public setLoudnessNormalization(enabled: boolean): void {
		this.loudnessNormalizationEnabled = enabled
		this.applyLoudnessGain()
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
