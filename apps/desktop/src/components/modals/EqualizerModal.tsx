import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
	X,
	SlidersHorizontal,
	Sparkles,
	Headphones,
	Volume2,
	Compass,
	RotateCcw,
	Info,
	Check,
	Shuffle,
	AudioWaveform,
	Plus,
	Trash2,
	Bookmark,
} from 'lucide-react'
import {
	EQ_FREQUENCIES,
	EQ_FREQ_LABELS,
	EQ_PRESETS,
	getEqualizerSettings,
	saveEqualizerSettings,
	DEFAULT_EQ_SETTINGS,
	getCustomPresets,
	saveCustomPreset,
	updateCustomPreset,
	deleteCustomPreset,
	MAX_CUSTOM_PRESETS,
	type EqualizerSettings,
	type EQPreset,
	type SpatialDeviceType,
	type SpatialHeadphoneMode,
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
	const [customPresets, setCustomPresets] = useState<EQPreset[]>(() =>
		getCustomPresets(),
	)
	const [isCreatingPreset, setIsCreatingPreset] = useState(false)
	const [presetNameInput, setPresetNameInput] = useState('')
	const [saveError, setSaveError] = useState<string | null>(null)

	// 当弹窗打开时重新同步配置
	useEffect(() => {
		if (isOpen) {
			setSettings(getEqualizerSettings())
			setCustomPresets(getCustomPresets())
			setIsCreatingPreset(false)
			setPresetNameInput('')
			setSaveError(null)
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

	const handleStartCreatePreset = () => {
		if (customPresets.length >= MAX_CUSTOM_PRESETS) {
			setSaveError(`自定义预设已达上限 (至多 ${MAX_CUSTOM_PRESETS} 条)，请先删除已有预设`)
			return
		}
		setSaveError(null)
		setPresetNameInput(`自定义预设 ${customPresets.length + 1}`)
		setIsCreatingPreset(true)
	}

	const handleConfirmSavePreset = () => {
		const res = saveCustomPreset(presetNameInput, settings.gains)
		if (!res.success || !res.preset) {
			setSaveError(res.message || '保存失败')
			return
		}
		const updatedList = getCustomPresets()
		setCustomPresets(updatedList)
		setIsCreatingPreset(false)
		setPresetNameInput('')
		setSaveError(null)
		// 自动选中新保存的预设
		updateSettings({
			...settings,
			enabled: true,
			presetId: res.preset.id,
			gains: [...res.preset.gains],
		})
	}

	const handleDeletePreset = (e: React.MouseEvent, presetId: string) => {
		e.stopPropagation()
		deleteCustomPreset(presetId)
		const updatedList = getCustomPresets()
		setCustomPresets(updatedList)
		if (settings.presetId === presetId) {
			// 若当前选中的正好是被删除的预设，回退到默认平直
			updateSettings({
				...settings,
				presetId: 'flat',
				gains: [...EQ_PRESETS[0].gains],
			})
		}
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

	const handleSpatialToggle = () => {
		updateSettings({
			...settings,
			spatialSurroundEnabled: !settings.spatialSurroundEnabled,
		})
	}

	const handleDeviceTypeChange = (type: SpatialDeviceType) => {
		updateSettings({
			...settings,
			spatialSurroundEnabled: true,
			spatialDeviceType: type,
		})
	}

	const handleHeadphoneModeChange = (mode: SpatialHeadphoneMode) => {
		updateSettings({
			...settings,
			spatialSurroundEnabled: true,
			spatialHeadphoneMode: mode,
		})
	}

	const handleSpeakerWideningChange = (val: number) => {
		updateSettings({
			...settings,
			spatialSpeakerWidening: Math.max(0, Math.min(1, val)),
		})
	}

	const handleSpeakerCrossDelayChange = (val: number) => {
		updateSettings({
			...settings,
			spatialSpeakerCrossDelay: Math.max(0, Math.min(1, val)),
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

	const allPresets = [...EQ_PRESETS, ...customPresets]
	const activePreset =
		allPresets.find((p) => p.id === settings.presetId) ||
		(settings.presetId === 'custom'
			? {
					id: 'custom',
					name: '自定义 (微调中)',
					gains: settings.gains,
					desc: '自由微调每个频段增益',
			  }
			: EQ_PRESETS[0])

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
								EQ 均衡器
								<span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
									DSP
								</span>
							</h2>
							{activePreset?.desc ? (
								<p className="text-xs text-muted-foreground mt-0.5">
									{activePreset.desc}
								</p>
							) : null}
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
					<div className="space-y-3">
						<div className="text-xs font-medium text-muted-foreground flex items-center justify-between">
							<span className="flex items-center gap-1.5">
								<Bookmark className="w-3.5 h-3.5 text-[#00AEEC]" />
								音效预设 (Presets)
							</span>
							<span className="text-[11px] text-[#00AEEC]">
								当前: {activePreset?.name || '自定义'}
							</span>
						</div>

						{/* 官方内置预设 */}
						<div className="flex flex-wrap gap-1.5 sm:gap-2">
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
										{preset.name}
									</button>
								)
							})}
						</div>

						{/* 自定义预设管理区域 (至多 6 条) */}
						<div className="pt-2.5 border-t border-white/5">
							<div className="flex items-center justify-between mb-2">
								<span className="text-[11px] text-muted-foreground/90 font-medium">
									我的自定义预设 ({customPresets.length}/{MAX_CUSTOM_PRESETS})
								</span>

								{!isCreatingPreset && (
									<button
										onClick={handleStartCreatePreset}
										disabled={customPresets.length >= MAX_CUSTOM_PRESETS}
										className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#00AEEC]/15 hover:bg-[#00AEEC]/25 text-[#00AEEC] border border-[#00AEEC]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
										title={
											customPresets.length >= MAX_CUSTOM_PRESETS
												? `已达上限 (${MAX_CUSTOM_PRESETS}条)`
												: '将当前 10 段 EQ 增益保存为自定义预设'
										}
									>
										<Plus className="w-3.5 h-3.5" />
										保存为预设
									</button>
								)}
							</div>

							{/* 正在新建预设的输入栏 */}
							{isCreatingPreset && (
								<div className="mb-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-[#00AEEC]/40 space-y-2 animate-in fade-in duration-150">
									<div className="flex items-center gap-2">
										<input
											type="text"
											value={presetNameInput}
											onChange={(e) => {
												setPresetNameInput(e.target.value)
												setSaveError(null)
											}}
											maxLength={16}
											autoFocus
											placeholder="请输入预设名称 (如: 暖声氛围)"
											onKeyDown={(e) => {
												if (e.key === 'Enter') handleConfirmSavePreset()
												if (e.key === 'Escape') setIsCreatingPreset(false)
											}}
											className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#00AEEC]"
										/>
										<button
											onClick={handleConfirmSavePreset}
											className="px-3 py-1 rounded-lg bg-[#00AEEC] hover:bg-[#1bbefa] text-white text-xs font-medium transition-colors"
										>
											确认保存
										</button>
										<button
											onClick={() => {
												setIsCreatingPreset(false)
												setSaveError(null)
											}}
											className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-muted-foreground hover:text-white text-xs transition-colors"
										>
											取消
										</button>
									</div>
									{saveError && (
										<p className="text-[11px] text-red-400">{saveError}</p>
									)}
								</div>
							)}

							{/* 自定义预设列表 */}
							{customPresets.length === 0 ? (
								<div className="text-[11px] text-muted-foreground/60 py-1">
									暂无自定义预设，调整均衡器推子后点击右上角“保存为预设”即可收藏（至多6条）
								</div>
							) : (
								<div className="flex flex-wrap gap-1.5 sm:gap-2">
									{customPresets.map((preset) => {
										const isSelected = settings.presetId === preset.id
										return (
											<div
												key={preset.id}
												onClick={() => handleSelectPreset(preset)}
												className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
													isSelected
														? 'bg-[#00AEEC] text-white shadow-[0_2px_8px_rgba(0,174,236,0.35)] scale-105'
														: 'bg-white/5 hover:bg-white/10 text-foreground/80 hover:text-white border border-white/5'
												}`}
											>
												<span className="max-w-[100px] truncate">{preset.name}</span>
												<button
													onClick={(e) => handleDeletePreset(e, preset.id)}
													className="p-1 rounded hover:bg-black/30 text-white/60 hover:text-red-300 transition-colors"
													title="删除此预设"
												>
													<Trash2 className="w-3 h-3" />
												</button>
											</div>
										)
									})}
								</div>
							)}
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

					{/* 全景环绕空间音效面板 (Spatial Surround) */}
					<div
						className={`p-4 rounded-xl border transition-all ${
							settings.spatialSurroundEnabled
								? 'bg-gradient-to-br from-[#00AEEC]/12 via-[#1e1e24] to-indigo-500/10 border-[#00AEEC]/50 shadow-[0_4px_20px_rgba(0,174,236,0.15)]'
								: 'bg-white/[0.02] border-white/10'
						}`}
					>
						{/* 标题栏与总开关 */}
						<div className="flex items-center justify-between mb-3.5">
							<div className="flex items-center gap-2.5">
								<div
									className={`p-2 rounded-xl transition-colors ${
										settings.spatialSurroundEnabled
											? 'bg-[#00AEEC] text-white shadow-md'
											: 'bg-white/10 text-muted-foreground'
									}`}
								>
									<Compass className="w-4 h-4" />
								</div>
								<div>
									<div className="flex items-center gap-2">
										<h4 className="text-xs font-semibold text-white">
											全景环绕空间音效
										</h4>
										<span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#00AEEC]/20 text-[#00AEEC] border border-[#00AEEC]/30">
											3D Spatial
										</span>
									</div>
									<p className="text-[11px] text-muted-foreground mt-0.5">
										{settings.spatialDeviceType === 'headphone'
											? '耳机双耳空间化定位与声场扩展算法，消除耳道局促与头中效应'
											: '音箱近场声学优化：M/S 声场拉宽与微交叉延迟（已停用耳机 HRTF）'}
									</p>
								</div>
							</div>

							<button
								type="button"
								onClick={handleSpatialToggle}
								className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
									settings.spatialSurroundEnabled
										? 'bg-[#00AEEC] text-white shadow-[0_2px_10px_rgba(0,174,236,0.35)]'
										: 'bg-white/10 text-muted-foreground hover:bg-white/15 hover:text-white'
								}`}
								title={settings.spatialSurroundEnabled ? '点击关闭全景环绕' : '点击开启全景环绕'}
							>
								<div
									className={`w-2 h-2 rounded-full ${
										settings.spatialSurroundEnabled
											? 'bg-white animate-pulse'
											: 'bg-muted-foreground/60'
									}`}
								/>
								{settings.spatialSurroundEnabled ? '全景已开启' : '全景已关闭'}
							</button>
						</div>

						{/* 设备类型分段切换器 */}
						<div className="grid grid-cols-2 gap-2 p-1 bg-black/30 rounded-xl border border-white/5 mb-3.5">
							<button
								type="button"
								onClick={() => handleDeviceTypeChange('headphone')}
								className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
									settings.spatialDeviceType === 'headphone'
										? 'bg-[#00AEEC] text-white shadow-sm'
										: 'text-muted-foreground hover:text-white hover:bg-white/5'
								}`}
							>
								<Headphones className="w-3.5 h-3.5" />
								<span>耳机</span>
							</button>
							<button
								type="button"
								onClick={() => handleDeviceTypeChange('speaker')}
								className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
									settings.spatialDeviceType === 'speaker'
										? 'bg-[#00AEEC] text-white shadow-sm'
										: 'text-muted-foreground hover:text-white hover:bg-white/5'
								}`}
							>
								<Volume2 className="w-3.5 h-3.5" />
								<span>音箱</span>
							</button>
						</div>

						{/* 耳机预设算法分支 */}
						{settings.spatialDeviceType === 'headphone' ? (
							<div className="space-y-2">
								<div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
									<span>耳机空间算法模式</span>
									<span className="text-[#00AEEC]">
										{settings.spatialHeadphoneMode === 'dts'
											? 'DTS Headphone:X'
											: settings.spatialHeadphoneMode === 'hrtf'
											? 'HRTF 双耳定位'
											: 'HeSuVi 7.1 虚拟声场'}
									</span>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
									{/* DTS Headphone:X */}
									<button
										type="button"
										onClick={() => handleHeadphoneModeChange('dts')}
										className={`p-2.5 rounded-xl border text-left transition-all ${
											settings.spatialHeadphoneMode === 'dts'
												? 'bg-[#00AEEC]/15 border-[#00AEEC]/60 text-white shadow-sm'
												: 'bg-white/[0.02] border-white/5 text-muted-foreground hover:text-white hover:bg-white/5'
										}`}
									>
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-semibold text-white">
												DTS Headphone:X
											</span>
											{settings.spatialHeadphoneMode === 'dts' && (
												<Check className="w-3.5 h-3.5 text-[#00AEEC]" />
											)}
										</div>
										<p className="text-[10px] text-muted-foreground/90 leading-tight">
											影院全景声拟真，宽视角前置声场与早期环境微混响，氛围沉浸
										</p>
									</button>

									{/* HRTF */}
									<button
										type="button"
										onClick={() => handleHeadphoneModeChange('hrtf')}
										className={`p-2.5 rounded-xl border text-left transition-all ${
											settings.spatialHeadphoneMode === 'hrtf'
												? 'bg-[#00AEEC]/15 border-[#00AEEC]/60 text-white shadow-sm'
												: 'bg-white/[0.02] border-white/5 text-muted-foreground hover:text-white hover:bg-white/5'
										}`}
									>
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-semibold text-white">
												HRTF 双耳定位
											</span>
											{settings.spatialHeadphoneMode === 'hrtf' && (
												<Check className="w-3.5 h-3.5 text-[#00AEEC]" />
											)}
										</div>
										<p className="text-[10px] text-muted-foreground/90 leading-tight">
											纯净头部相关传输函数，耳廓滤波与头影低通衰减，自然消除压迫感
										</p>
									</button>

									{/* HeSuVi */}
									<button
										type="button"
										onClick={() => handleHeadphoneModeChange('hesuvi')}
										className={`p-2.5 rounded-xl border text-left transition-all ${
											settings.spatialHeadphoneMode === 'hesuvi'
												? 'bg-[#00AEEC]/15 border-[#00AEEC]/60 text-white shadow-sm'
												: 'bg-white/[0.02] border-white/5 text-muted-foreground hover:text-white hover:bg-white/5'
										}`}
									>
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-semibold text-white">
												HeSuVi 7.1
											</span>
											{settings.spatialHeadphoneMode === 'hesuvi' && (
												<Check className="w-3.5 h-3.5 text-[#00AEEC]" />
											)}
										</div>
										<p className="text-[10px] text-muted-foreground/90 leading-tight">
											7.1 虚拟声场多声道混合仿真，侧后方离散延迟还原环绕包围感
										</p>
									</button>
								</div>
							</div>
						) : (
							/* 电脑音箱分支 */
							<div className="space-y-3">
								{/* 醒目说明：严禁套用耳机 HRTF */}
								<div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] leading-relaxed">
									<Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
									<span>
										<strong>音箱专属防干涉策略</strong>：音箱处于真实房间环境，空气中已具备天然双耳串扰。本模式<strong>已严格停用耳机 HRTF 滤波器</strong>（避免耳廓模型在音箱叠加引发梳状滤波失真与中频空洞），专享<strong>立体声拉宽</strong>与<strong>近场微交叉延迟</strong>。
									</span>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{/* 调节项 1: 立体声拉宽 */}
									<div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-white">
												立体声拉宽 (Stereo Widener)
											</span>
											<span className="text-xs font-mono font-semibold text-[#00AEEC]">
												{Math.round(settings.spatialSpeakerWidening * 100)}%
											</span>
										</div>
										<p className="text-[10px] text-muted-foreground leading-normal">
											M/S 侧向声场展开，突破桌面音箱狭窄间距限制；低频居中锁定，防止相位抵消。
										</p>
										<input
											type="range"
											min="0"
											max="1"
											step="0.05"
											value={settings.spatialSpeakerWidening}
											disabled={!settings.spatialSurroundEnabled}
											onChange={(e) =>
												handleSpeakerWideningChange(parseFloat(e.target.value))
											}
											className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
											style={{ accentColor: '#00AEEC' }}
										/>
									</div>

									{/* 调节项 2: 轻微交叉延迟 */}
									<div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-white">
												轻微交叉延迟 (Crossfeed Delay)
											</span>
											<span className="text-xs font-mono font-semibold text-[#00AEEC]">
												{Math.round(settings.spatialSpeakerCrossDelay * 100)}%
											</span>
										</div>
										<p className="text-[10px] text-muted-foreground leading-normal">
											近场微延时与高频柔化串扰补充，消除两端生硬剥离，让声像自然凝聚在眼前。
										</p>
										<input
											type="range"
											min="0"
											max="1"
											step="0.05"
											value={settings.spatialSpeakerCrossDelay}
											disabled={!settings.spatialSurroundEnabled}
											onChange={(e) =>
												handleSpeakerCrossDelayChange(parseFloat(e.target.value))
											}
											className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
											style={{ accentColor: '#00AEEC' }}
										/>
									</div>
								</div>
							</div>
						)}
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
