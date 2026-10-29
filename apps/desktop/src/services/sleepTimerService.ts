import { desktopAudioEngine } from '../audio/DesktopAudioEngine'

export type SleepTimerMode = 'off' | 'duration' | 'end_of_track'

export interface SleepTimerState {
	isActive: boolean
	mode: SleepTimerMode
	totalSeconds: number
	remainingSeconds: number
}

type SleepTimerListener = (state: SleepTimerState) => void

/**
 * 睡眠定时关闭服务 (Sleep Timer Service)
 *
 * 功能规范：
 * 1. 支持指定时长倒计时（预设 15/30/45/60/90 分钟及自定义分钟数）；
 * 2. 支持“播完当前歌曲后停止播放”；
 * 3. 倒计时结束前 10 秒平滑渐隐音量，防止突兀暂停惊醒入眠；
 * 4. 暂停后安全还原基准音量，确保下次播放音量正常。
 */
class SleepTimerService {
	private mode: SleepTimerMode = 'off'
	private totalSeconds = 0
	private remainingSeconds = 0
	private timerId: any = null
	private listeners: Set<SleepTimerListener> = new Set()
	private originalVolume: number | null = null
	private playbackUnsubscribe: (() => void) | null = null

	constructor() {
		if (typeof window !== 'undefined') {
			desktopAudioEngine.subscribe((e) => {
				if (this.mode === 'end_of_track' && e.type === 'ended') {
					this.triggerStop()
				}
			})
		}
	}

	public getState(): SleepTimerState {
		return {
			isActive: this.mode !== 'off',
			mode: this.mode,
			totalSeconds: this.totalSeconds,
			remainingSeconds: this.remainingSeconds,
		}
	}

	public subscribe(listener: SleepTimerListener): () => void {
		this.listeners.add(listener)
		listener(this.getState())
		return () => this.listeners.delete(listener)
	}

	private notify(): void {
		const state = this.getState()
		this.listeners.forEach((l) => l(state))
		if (typeof window !== 'undefined') {
			window.dispatchEvent(
				new CustomEvent('bbplayer:sleep-timer-changed', { detail: state }),
			)
		}
	}

	/**
	 * 开启倒计时定时停止播放
	 * @param minutes 分钟数 (1 ~ 360)
	 */
	public setDurationTimer(minutes: number): void {
		this.cancel()
		const sec = Math.max(1, Math.round(minutes * 60))
		this.mode = 'duration'
		this.totalSeconds = sec
		this.remainingSeconds = sec

		this.timerId = setInterval(() => {
			this.remainingSeconds--

			// 倒计时最后 10 秒平滑淡出音量
			if (this.remainingSeconds <= 10 && this.remainingSeconds > 0) {
				if (this.originalVolume === null) {
					this.originalVolume = desktopAudioEngine.getVolume()
				}
				const factor = this.remainingSeconds / 10
				desktopAudioEngine.setVolume(this.originalVolume * factor)
			} else if (this.remainingSeconds <= 0) {
				this.triggerStop()
			}
			this.notify()
		}, 1000)

		this.notify()
	}

	/**
	 * 开启“播完当前歌曲后停止”
	 */
	public setEndOfTrackTimer(): void {
		this.cancel()
		this.mode = 'end_of_track'
		this.totalSeconds = 0
		this.remainingSeconds = 0
		this.notify()
	}

	/**
	 * 取消定时关闭
	 */
	public cancel(): void {
		if (this.timerId) {
			clearInterval(this.timerId)
			this.timerId = null
		}
		if (this.originalVolume !== null) {
			desktopAudioEngine.setVolume(this.originalVolume)
			this.originalVolume = null
		}
		this.mode = 'off'
		this.totalSeconds = 0
		this.remainingSeconds = 0
		this.notify()
	}

	/**
	 * 触发停止动作并还原现场
	 */
	private triggerStop(): void {
		desktopAudioEngine.pause()
		if (this.originalVolume !== null) {
			desktopAudioEngine.setVolume(this.originalVolume)
			this.originalVolume = null
		}
		this.cancel()
	}
}

export const sleepTimerService = new SleepTimerService()
