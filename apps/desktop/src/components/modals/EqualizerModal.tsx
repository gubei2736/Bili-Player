import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
	X,
	SlidersHorizontal,
	Sparkles,
	Headphones,
	RotateCcw,
	Info,
	Check,
	Shuffle,
	AudioWaveform,
} from 'lucide-react'
import {
	EQ_FREQUENCIES,
	EQ_FREQ_LABELS,
	EQ_PRESETS,
	getEqualizerSettings,
	saveEqualizerSettings,
	DEFAULT_EQ_SETTINGS,
	type EqualizerSettings,
	type EQPreset,
} from '../../audio/equalizerSettings'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'

export interface EqualizerModalProps {
	isOpen: boolean
	onClose: () => void
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
	isOpen,
	onClose,
}) => {
	const [settings, setSettings] = useState<EqualizerSettings>(() =>
		getEqualizerSettings(),
	)

	// 当弹窗打开时重新同步配置
	useEffect(() => {
		if (isOpen) {
			setSettings(getEqualizerSettings())
		}
	}, [isOpen])

	if (!isOpen) return null

	const updateSettings = (newSettings: EqualizerSettings) => {
		setSettings(newSettings)
		saveEqualizerSettings(newSettings)
		desktopAudioEngine.updateEqualizer(newSettings)
	}

	const handleMasterToggle = () => {
		const nextEnabled = !settings.enabled
		updateSettings({
			...settings,
			enabled: nextEnabled,
		})
	}

	const handleSelectPreset = (preset: EQPreset) => {
		updateSettings({
			...settings,
			enabled: true,
			presetId: preset.id,
			gains: [...preset.gains],
		})
	}

	const handleGainChange = (bandIndex: number, val: number) => {
		const newGains = [...settings.gains]
		newGains[bandIndex] = Math.max(-12, Math.min(12, val))
		updateSettings({
			...settings,
			enabled: true,
			presetId: 'custom',
			gains: newGains,
		})
	}

	const handleResetBand = (bandIndex: number) => {
		handleGainChange(bandIndex, 0)
	}

	const handleVocalEnhancerToggle = () => {
		updateSettings({
			...settings,
			vocalEnhancerEnabled: !settings.vocalEnhancerEnabled,
		})
	}

	const handleCrossfeedToggle = () => {
		updateSettings({
			...settings,
			crossfeedEnabled: !settings.crossfeedEnabled,
		})
	}

	const handleCrossfadeToggle = () => {
		updateSettings({
			...settings,
			crossfadeEnabled: !settings.crossfadeEnabled,
		})
	}

	const handleCrossfadeDurationChange = (duration: number) => {
		updateSettings({
			...settings,
			crossfadeDuration: Math.max(0.3, Math.min(3.5, duration)),
		})
	}

	const handleResetAll = () => {
		updateSettings({
			...DEFAULT_EQ_SETTINGS,
			enabled: true,
			presetId: 'flat',
		})
	}

	const activePreset =
		EQ_PRESETS.find((p) => p.id === settings.presetId) ||
		EQ_PRESETS[EQ_PRESETS.length - 1]

	return createPortal(
		<div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
			{/* Backdrop click outside */}
			<div className="absolute inset-0" onClick={onClose} />

			{/* Modal Card */}
			<div
				className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#1e1e24]/95 border border-white/10 shadow-2xl text-foreground overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* 1. Header Bar */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-[#00AEEC]/15 text-[#00AEEC]">
							<SlidersHorizontal className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-base font-semibold text-white flex items-center gap-2">
								EQ 均衡器与人声增强
								<span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
									Web Audio 32-bit DSP
								</span>
							</h2>
							<p className="text-xs text-muted-foreground mt-0.5">
								{activePreset?.desc || '自由微调 10 频段增益与听觉声场'}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{/* Master Enable Switch */}
						<button
							onClick={handleMasterToggle}
							className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
								settings.enabled
									? 'bg-[#00AEEC] text-white shadow-[0_2px_10px_rgba(0,174,236,0.4)]'
									: 'bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-white'
							}`}
							title={settings.enabled ? '点击旁通 (Bypass)' : '点击启用均衡器'}
						>
							<div
								className={`w-2 h-2 rounded-full ${
									settings.enabled ? 'bg-white animate-pulse' : 'bg-muted-foreground/60'
								}`}
							/>
							{settings.enabled ? 'EQ 已启用' : 'EQ 已旁通'}
						</button>

						{/* Close Button */}
						<button
							onClick={onClose}
							className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* 2. Scrollable Content Area */}
				<div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 custom-scrollbar">
					{/* Presets Bar */}
					<div>
						<div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
							<span>音效预设 (Presets)</span>
							<span className="text-[11px] text-[#00AEEC]">
								当前: {activePreset?.name}
							</span>
						</div>
						<div className="flex flex-wrap gap-2">
							{EQ_PRESETS.map((preset) => {
								const isSelected = settings.presetId === preset.id
								return (
									<button
										key={preset.id}
										onClick={() => handleSelectPreset(preset)}
										className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
											isSelected
												? 'bg-[#00AEEC] text-white shadow-[0_2px_8px_rgba(0,174,236,0.35)] scale-105'
												: 'bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-white border border-white/5'
										}`}
									>
										{preset.id === 'vocal' && (
											<Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5 text-amber-300" />
										)}
										{preset.name}
									</button>
								)
							})}
						</div>
					</div>

					{/* 2 Special Enhancement Feature Cards */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{/* Feature 1: Vocal Clarity Filter */}
						<div
							onClick={handleVocalEnhancerToggle}
							className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
								settings.vocalEnhancerEnabled
									? 'bg-[#00AEEC]/10 border-[#00AEEC]/40 shadow-[0_2px_12px_rgba(0,174,236,0.15)]'
									: 'bg-white/[0.02] border-white/10 hover:border-white/20'
							}`}
						>
							<div className="flex items-center justify-between mb-1.5">
								<div className="flex items-center gap-2">
									<div
										className={`p-1.5 rounded-lg ${
											settings.vocalEnhancerEnabled
												? 'bg-[#00AEEC] text-white'
												: 'bg-white/10 text-muted-foreground'
										}`}
									>
										<Sparkles className="w-4 h-4" />
									</div>
									<div>
										<h4 className="text-xs font-semibold text-white">
											人声增强滤镜
										</h4>
										<span className="text-[10px] text-muted-foreground">
											智能突出 1.8k~2.5kHz 中频
										</span>
									</div>
								</div>
								<div
									className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
										settings.vocalEnhancerEnabled
											? 'bg-[#00AEEC]'
											: 'bg-white/20'
									}`}
								>
									<div
										className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
											settings.vocalEnhancerEnabled
												? 'translate-x-4'
												: 'translate-x-0'
										}`}
									/>
								</div>
							</div>
							<p className="text-[11px] text-muted-foreground/90 leading-relaxed">
								针对 B 站翻唱与复杂伴奏，微滤低频浑浊，让人声与对白更清晰通透。
							</p>
						</div>

						{/* Feature 2: Headphone Crossfeed */}
						<div
							onClick={handleCrossfeedToggle}
							className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
								settings.crossfeedEnabled
									? 'bg-[#00AEEC]/10 border-[#00AEEC]/40 shadow-[0_2px_12px_rgba(0,174,236,0.15)]'
									: 'bg-white/[0.02] border-white/10 hover:border-white/20'
							}`}
						>
							<div className="flex items-center justify-between mb-1.5">
								<div className="flex items-center gap-2">
									<div
										className={`p-1.5 rounded-lg ${
											settings.crossfeedEnabled
												? 'bg-[#00AEEC] text-white'
												: 'bg-white/10 text-muted-foreground'
										}`}
									>
										<Headphones className="w-4 h-4" />
									</div>
									<div>
										<h4 className="text-xs font-semibold text-white">
											耳机声场防疲劳
										</h4>
										<span className="text-[10px] text-muted-foreground">
											Binaural Crossfeed
										</span>
									</div>
								</div>
								<div
									className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
										settings.crossfeedEnabled
											? 'bg-[#00AEEC]'
											: 'bg-white/20'
									}`}
								>
									<div
										className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
											settings.crossfeedEnabled
												? 'translate-x-4'
												: 'translate-x-0'
										}`}
									/>
								</div>
							</div>
							<p className="text-[11px] text-muted-foreground/90 leading-relaxed">
								微延迟交叉模拟立体声音箱扩散，消除耳机头中效应（使用音箱外放请关闭）。
							</p>
						</div>
					</div>

					{/* 10-Band Graphic EQ Board */}
					<div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
						<div className="flex items-center justify-between mb-4">
							<span className="text-xs font-medium text-foreground/90 flex items-center gap-1.5">
								<AudioWaveform className="w-3.5 h-3.5 text-[#00AEEC]" />
								10 频段图示均衡器 (-12dB ~ +12dB)
							</span>
							<span className="text-[11px] text-muted-foreground">
								双击数值或推子即可归零
							</span>
						</div>

						{/* Sliders Container */}
						<div className="grid grid-cols-10 gap-1.5 sm:gap-2 items-center">
							{EQ_FREQUENCIES.map((freq, idx) => {
								const gain = settings.gains[idx] ?? 0
								const label = EQ_FREQ_LABELS[idx]
								const isZero = Math.abs(gain) < 0.1
								return (
									<div
										key={freq}
										className="flex flex-col items-center group"
										onDoubleClick={() => handleResetBand(idx)}
									>
										{/* Gain Value Label */}
										<span
											onClick={() => handleResetBand(idx)}
											title="双击归零"
											className={`text-[10px] font-mono font-medium mb-2 cursor-pointer transition-colors ${
												!isZero
													? 'text-[#00AEEC] font-semibold'
													: 'text-muted-foreground/70 group-hover:text-white'
											}`}
										>
											{gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
										</span>

										{/* Vertical Range Slider */}
										<div className="relative w-6 h-36 flex items-center justify-center">
											{/* 0dB Reference line */}
											<div className="absolute w-full h-[1px] bg-white/20 top-1/2 pointer-events-none" />

											<input
												type="range"
												min="-12"
												max="12"
												step="0.5"
												value={gain}
												disabled={!settings.enabled}
												onChange={(e) =>
													handleGainChange(idx, parseFloat(e.target.value))
												}
												className="eq-vertical-slider w-32 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed -rotate-90"
												style={{
													accentColor: '#00AEEC',
												}}
											/>
										</div>

										{/* Frequency Label */}
										<span className="text-[10px] text-muted-foreground font-mono mt-2 group-hover:text-white transition-colors">
											{label}
										</span>
									</div>
								)
							})}
						</div>
					</div>

					{/* Playback Transition: Soft Pause & Crossfade */}
					<div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="flex items-center gap-2.5">
							<div className="p-1.5 rounded-lg bg-white/10 text-muted-foreground">
								<Shuffle className="w-4 h-4" />
							</div>
							<div>
								<h4 className="text-xs font-semibold text-white flex items-center gap-2">
									平滑交叉淡入淡出 (Crossfade)
									{settings.crossfadeEnabled && (
										<span className="text-[10px] text-[#00AEEC] font-normal">
											{settings.crossfadeDuration.toFixed(1)} 秒
										</span>
									)}
								</h4>
								<p className="text-[11px] text-muted-foreground">
									双 Audio 乒乓槽位交替预热，切歌无感无爆音，软暂停淡出
								</p>
							</div>
						</div>

						<div className="flex items-center gap-3">
							{settings.crossfadeEnabled && (
								<input
									type="range"
									min="0.5"
									max="3.0"
									step="0.1"
									value={settings.crossfadeDuration}
									onChange={(e) =>
										handleCrossfadeDurationChange(parseFloat(e.target.value))
									}
									className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
									style={{ accentColor: '#00AEEC' }}
								/>
							)}

							<button
								onClick={handleCrossfadeToggle}
								className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
									settings.crossfadeEnabled
										? 'bg-[#00AEEC] text-white shadow-sm'
										: 'bg-white/10 text-muted-foreground hover:bg-white/15'
								}`}
							>
								{settings.crossfadeEnabled ? '已开启' : '已关闭'}
							</button>
						</div>
					</div>
				</div>

				{/* 3. Footer Bar */}
				<div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-white/[0.02]">
					<button
						onClick={handleResetAll}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
					>
						<RotateCcw className="w-3.5 h-3.5" />
						重置为默认
					</button>

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
