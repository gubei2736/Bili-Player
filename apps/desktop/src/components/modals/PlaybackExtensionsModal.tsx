import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
	X,
	Gauge,
	Moon,
	Clock,
	Check,
	RotateCcw,
	AlertCircle,
	Sparkles,
} from 'lucide-react'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'
import {
	sleepTimerService,
	type SleepTimerState,
} from '../../services/sleepTimerService'

export interface PlaybackExtensionsModalProps {
	isOpen: boolean
	onClose: () => void
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

const TIMER_PRESETS = [
	{ label: '15 分钟', minutes: 15 },
	{ label: '30 分钟', minutes: 30 },
	{ label: '45 分钟', minutes: 45 },
	{ label: '60 分钟', minutes: 60 },
]

export const PlaybackExtensionsModal: React.FC<PlaybackExtensionsModalProps> = ({
	isOpen,
	onClose,
}) => {
	// 播放速度状态
	const [playbackRate, setPlaybackRate] = useState<number>(() =>
		desktopAudioEngine.getPlaybackRate(),
	)

	// 定时关闭状态
	const [timerState, setTimerState] = useState<SleepTimerState>(() =>
		sleepTimerService.getState(),
	)
	const [customMinutes, setCustomMinutes] = useState('25')

	useEffect(() => {
		if (!isOpen) return

		// 同步当前播放速率
		setPlaybackRate(desktopAudioEngine.getPlaybackRate())
		const handleRateChange = (e: any) => {
			if (e.detail?.playbackRate) {
				setPlaybackRate(e.detail.playbackRate)
			}
		}
		window.addEventListener('bbplayer:playback-rate-changed', handleRateChange)

		// 同步定时关闭状态
		setTimerState(sleepTimerService.getState())
		const unsubscribeTimer = sleepTimerService.subscribe((s) => {
			setTimerState({ ...s })
		})

		return () => {
			window.removeEventListener(
				'bbplayer:playback-rate-changed',
				handleRateChange,
			)
			unsubscribeTimer()
		}
	}, [isOpen])

	if (!isOpen) return null

	// 播放速率调节
	const handleSelectSpeed = (rate: number) => {
		desktopAudioEngine.setPlaybackRate(rate)
		setPlaybackRate(rate)
	}

	const handleResetSpeed = () => {
		handleSelectSpeed(1.0)
	}

	// 定时关闭调节
	const formatRemaining = (seconds: number) => {
		const m = Math.floor(seconds / 60)
		const s = seconds % 60
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
	}

	const handleSelectDuration = (minutes: number) => {
		sleepTimerService.setDurationTimer(minutes)
	}

	const handleSelectEndOfTrack = () => {
		sleepTimerService.setEndOfTrackTimer()
	}

	const handleCustomSubmit = (e?: React.FormEvent) => {
		if (e) e.preventDefault()
		const mins = parseInt(customMinutes, 10)
		if (!isNaN(mins) && mins > 0 && mins <= 360) {
			sleepTimerService.setDurationTimer(mins)
		}
	}

	const handleCancelTimer = () => {
		sleepTimerService.cancel()
	}

	return createPortal(
		<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
			{/* Backdrop */}
			<div className="absolute inset-0" onClick={onClose} />

			{/* Modal Card */}
			<div
				className="relative z-10 w-full max-w-lg flex flex-col rounded-2xl bg-[#1e1e24]/95 border border-white/10 shadow-2xl text-foreground overflow-hidden animate-in zoom-in-95 duration-200"
				onClick={(e) => e.stopPropagation()}
			>
				{/* 1. Header Bar */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-[#00AEEC]/15 text-[#00AEEC]">
							<Sparkles className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-base font-semibold text-white flex items-center gap-2">
								播放扩展功能
								<span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
									倍速 · 定时
								</span>
							</h3>
							<p className="text-xs text-muted-foreground mt-0.5">
								自定义播放速率与定时关闭
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* 2. Scrollable Content Area */}
				<div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto custom-scrollbar">
					{/* ==================== 功能 1: 播放速度自定义 ==================== */}
					<div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3.5">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="p-1.5 rounded-lg bg-[#00AEEC]/15 text-[#00AEEC]">
									<Gauge className="w-4 h-4" />
								</div>
								<div>
									<h4 className="text-xs font-semibold text-white">
										播放速度 (Playback Speed)
									</h4>
									<span className="text-[10px] text-muted-foreground">
										支持 0.5x ~ 3.0x 无级平滑变速，切歌自动保持
									</span>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<span className="text-xs font-mono font-bold text-[#00AEEC] bg-[#00AEEC]/15 px-2.5 py-1 rounded-lg border border-[#00AEEC]/30">
									{playbackRate.toFixed(2)}x
								</span>
								{playbackRate !== 1.0 && (
									<button
										onClick={handleResetSpeed}
										className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
										title="重置为 1.0x 正常速度"
									>
										<RotateCcw className="w-3 h-3" />
										重置
									</button>
								)}
							</div>
						</div>

						{/* Quick Preset Buttons */}
						<div className="grid grid-cols-6 gap-1.5">
							{SPEED_PRESETS.map((preset) => {
								const isSelected = Math.abs(playbackRate - preset) < 0.01
								return (
									<button
										key={preset}
										onClick={() => handleSelectSpeed(preset)}
										className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
											isSelected
												? 'bg-[#00AEEC] text-white shadow-[0_2px_8px_rgba(0,174,236,0.35)] scale-105'
												: 'bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-white border border-white/5'
										}`}
									>
										{preset.toFixed(preset % 1 === 0 ? 1 : 2)}x
									</button>
								)
							})}
						</div>

						{/* Continuous Speed Slider */}
						<div className="space-y-1.5 pt-1">
							<div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
								<span>0.50x</span>
								<span>1.00x (标准)</span>
								<span>2.00x</span>
								<span>3.00x</span>
							</div>
							<input
								type="range"
								min="0.5"
								max="3.0"
								step="0.05"
								value={playbackRate}
								onChange={(e) => handleSelectSpeed(parseFloat(e.target.value))}
								className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
								style={{ accentColor: '#00AEEC' }}
							/>
						</div>
					</div>

					{/* ==================== 功能 2: 定时关闭 (Sleep Timer) ==================== */}
					<div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3.5">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
									<Moon className="w-4 h-4" />
								</div>
								<div>
									<h4 className="text-xs font-semibold text-white">
										定时关闭 (Sleep Timer)
									</h4>
									<span className="text-[10px] text-muted-foreground">
										定时平滑停止播放，助你安心入眠
									</span>
								</div>
							</div>

							{timerState.isActive && (
								<button
									onClick={handleCancelTimer}
									className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors"
								>
									<RotateCcw className="w-3 h-3" />
									取消定时
								</button>
							)}
						</div>

						{/* Active Countdown Banner */}
						{timerState.isActive && (
							<div className="p-3.5 rounded-xl bg-gradient-to-r from-[#00AEEC]/15 via-indigo-500/15 to-[#00AEEC]/15 border border-[#00AEEC]/40 flex items-center justify-between animate-in fade-in">
								<div className="flex items-center gap-2.5">
									<div className="p-1.5 rounded-lg bg-[#00AEEC] text-white animate-pulse">
										<Clock className="w-4 h-4" />
									</div>
									<div>
										<div className="text-[10px] text-muted-foreground">
											{timerState.mode === 'end_of_track'
												? '已设定模式'
												: '倒计时剩余时间'}
										</div>
										<div className="text-base font-mono font-bold text-white tracking-wider">
											{timerState.mode === 'end_of_track'
												? '播完当前曲目停止'
												: formatRemaining(timerState.remainingSeconds)}
										</div>
									</div>
								</div>

								<span className="text-[11px] text-[#00AEEC] font-medium bg-[#00AEEC]/20 px-2.5 py-1 rounded-full border border-[#00AEEC]/30">
									运行中
								</span>
							</div>
						)}

						{/* Presets List */}
						<div className="space-y-2">
							<div className="grid grid-cols-2 gap-2">
								{/* End of Track Option */}
								<button
									type="button"
									onClick={handleSelectEndOfTrack}
									className={`col-span-2 p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
										timerState.isActive && timerState.mode === 'end_of_track'
											? 'bg-[#00AEEC] text-white border-[#00AEEC] shadow-[0_2px_10px_rgba(0,174,236,0.35)]'
											: 'bg-white/[0.03] border-white/5 text-foreground/90 hover:bg-white/10 hover:text-white'
									}`}
								>
									<div className="flex items-center gap-2">
										<Moon className="w-3.5 h-3.5" />
										<span className="text-xs font-medium">
											播完当前歌曲后停止
										</span>
									</div>
									{timerState.isActive &&
										timerState.mode === 'end_of_track' && (
											<Check className="w-3.5 h-3.5" />
										)}
								</button>

								{/* Duration Presets */}
								{TIMER_PRESETS.map((preset) => {
									const isCurrent =
										timerState.isActive &&
										timerState.mode === 'duration' &&
										Math.round(timerState.totalSeconds / 60) === preset.minutes

									return (
										<button
											key={preset.minutes}
											type="button"
											onClick={() => handleSelectDuration(preset.minutes)}
											className={`p-2 rounded-xl border text-center transition-all flex items-center justify-between px-3 ${
												isCurrent
													? 'bg-[#00AEEC] text-white border-[#00AEEC] shadow-[0_2px_10px_rgba(0,174,236,0.35)]'
													: 'bg-white/[0.03] border-white/5 text-foreground/90 hover:bg-white/10 hover:text-white'
											}`}
										>
											<span className="text-xs font-medium">
												{preset.label}
											</span>
											{isCurrent ? (
												<Check className="w-3.5 h-3.5" />
											) : (
												<span className="text-[10px] text-muted-foreground font-mono">
													{preset.minutes}m
												</span>
											)}
										</button>
									)
								})}
							</div>
						</div>

						{/* Custom Duration Input Form */}
						<form
							onSubmit={handleCustomSubmit}
							className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5"
						>
							<span className="text-xs text-muted-foreground">自定义时长:</span>
							<input
								type="number"
								min="1"
								max="360"
								value={customMinutes}
								onChange={(e) => setCustomMinutes(e.target.value)}
								className="w-20 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#00AEEC]"
								placeholder="分钟"
							/>
							<span className="text-xs text-muted-foreground">分钟</span>
							<div className="flex-1" />
							<button
								type="submit"
								className="px-3.5 py-1 rounded-lg bg-[#00AEEC] hover:bg-[#1bbefa] text-white text-xs font-medium transition-colors"
							>
								设定
							</button>
						</form>

						{/* Soft Fade Out Tip */}
						<div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-muted-foreground leading-relaxed">
							<AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#00AEEC]" />
							<span>
								倒计时结束前 10 秒将自动平滑渐隐音量。
							</span>
						</div>
					</div>
				</div>

				{/* 3. Footer Bar */}
				<div className="flex items-center justify-end px-6 py-3 border-t border-white/10 bg-white/[0.02]">
					<button
						onClick={onClose}
						className="px-5 py-1.5 rounded-lg bg-[#00AEEC] hover:bg-[#1bbefa] active:bg-[#009fd6] text-white text-xs font-medium shadow-[0_2px_10px_rgba(0,174,236,0.4)] transition-all"
					>
						完成
					</button>
				</div>
			</div>
		</div>,
		document.body,
	)
}
