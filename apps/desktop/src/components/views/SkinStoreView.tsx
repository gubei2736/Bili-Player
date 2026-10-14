import React, { useState, useRef } from 'react'
import {
	Palette,
	Check,
	Sparkles,
	RefreshCw,
	Image as ImageIcon,
	Upload,
	Trash2,
	Eye,
	Type,
	Pipette,
} from 'lucide-react'
import { useSkinStore, type BilibiliGarbSuitDetailResponse } from '@bbplayer/shared-core'

interface PresetSkin {
	id: number
	name: string
	color: string
	coverUrl: string
	bgUrl?: string
	description: string
}

const PRESET_SKINS: PresetSkin[] = [
	{
		id: 1001,
		name: 'Bilibili 经典粉蓝',
		color: '#00AEEC',
		coverUrl: 'https://i0.hdslb.com/bfs/garb/item/249352e85a5498871183149ca6960b7ea1eafe8f.png',
		description: '经典哔哩哔哩主题装扮，灵动粉蓝撞色',
	},
	{
		id: 1002,
		name: '洛天依 · 天籁之音',
		color: '#66CCFF',
		coverUrl: 'https://i0.hdslb.com/bfs/garb/item/f3e7fc6cebf9613619934cbb0c5fc20f7823cecb.png',
		description: '天青色等烟雨，洛水天依常相伴',
	},
	{
		id: 1003,
		name: '初音未来 · 苍绿韵律',
		color: '#39C5BB',
		coverUrl: 'https://i0.hdslb.com/bfs/garb/item/42a1f0a1c1d8ea8f386d790d9796e95b05a766c6.png',
		description: '初音未来主题，电音与葱绿律动',
	},
	{
		id: 1004,
		name: '星穹铁道 · 银河漫游',
		color: '#D4AF37',
		coverUrl: 'https://i0.hdslb.com/bfs/garb/item/047f3b6d19bbda4ca1076f8ebaa912808b030b6d.png',
		description: '开拓者专属银河主题，沉金星轨质感',
	},
]

export const FONT_COLOR_PRESETS = [
	{ color: '#FFFFFF', name: '纯白 (默认)' },
	{ color: '#FDE047', name: '暖金' },
	{ color: '#38BDF8', name: '冰蓝' },
	{ color: '#F472B6', name: '柔粉' },
	{ color: '#34D399', name: '薄荷绿' },
	{ color: '#C084FC', name: '淡紫' },
	{ color: '#E2E8F0', name: '冷灰白' },
]

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

export function hexToHslTriple(hex: string): string {
	let c = hex.replace('#', '')
	if (c.length === 3) {
		c = c
			.split('')
			.map((x) => x + x)
			.join('')
	}
	const num = parseInt(c, 16)
	if (Number.isNaN(num)) return '210 25% 98%'
	const r = ((num >> 16) & 255) / 255
	const g = ((num >> 8) & 255) / 255
	const b = (num & 255) / 255
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	let h = 0
	let s = 0
	const l = (max + min) / 2
	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0)
				break
			case g:
				h = (b - r) / d + 2
				break
			case b:
				h = (r - g) / d + 4
				break
		}
		h /= 6
	}
	return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function applyFontColorToDom(color: string | null) {
	if (typeof document === 'undefined') return
	if (!color) {
		document.documentElement.style.removeProperty('--foreground')
		document.documentElement.style.removeProperty('--custom-text-color')
		return
	}
	const hsl = hexToHslTriple(color)
	document.documentElement.style.setProperty('--foreground', hsl)
	document.documentElement.style.setProperty('--custom-text-color', color)
}

export const SkinStoreView: React.FC = () => {
	const {
		activeSkinId,
		setSkin,
		clearSkin,
		customBgUrl,
		customBgOpacity,
		customBgBlur,
		customTextColor,
		setTextColor,
		setCustomBg,
		clearCustomBg,
	} = useSkinStore()

	const fileInputRef = useRef<HTMLInputElement | null>(null)

	const handleApplyPreset = (preset: PresetSkin) => {
		const mockSuit: BilibiliGarbSuitDetailResponse = {
			item_id: preset.id,
			name: preset.name,
			suit_items: {
				skin: [
					{
						item_id: preset.id,
						name: preset.name,
						properties: {
							color: preset.color,
							color_mode: 'dark',
							color_second_page: preset.color,
							tail_color: preset.color,
							tail_color_selected: preset.color,
						},
					},
				],
			},
		}
		setSkin(mockSuit)
		// Update CSS root variables
		const rgb = hexToRgbTriple(preset.color)
		document.documentElement.style.setProperty('--primary-rgb', rgb)
		document.documentElement.style.setProperty('--primary', preset.color)
		document.documentElement.style.setProperty('--bili-theme-primary', preset.color)
		document.documentElement.style.setProperty('--ring', preset.color)
	}

	const handleReset = () => {
		clearSkin()
		setTextColor(null)
		applyFontColorToDom(null)
		document.documentElement.style.setProperty('--primary-rgb', '0 174 236')
		document.documentElement.style.setProperty('--primary', '#00AEEC')
		document.documentElement.style.setProperty('--bili-theme-primary', '#00AEEC')
		document.documentElement.style.setProperty('--ring', '#00AEEC')
	}

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = (event) => {
			const res = event.target?.result as string
			if (res) {
				setCustomBg(res, customBgOpacity ?? 0.5, customBgBlur ?? 0)
			}
		}
		reader.readAsDataURL(file)
	}

	const handleSetFontColor = (color: string | null) => {
		setTextColor(color)
		applyFontColorToDom(color)
	}

	return (
		<div className="space-y-6 max-w-4xl pb-10">
			{/* Top Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-base font-bold text-foreground flex items-center gap-2">
						<Palette className="w-5 h-5 text-primary" />
						<span>个性装扮与主题</span>
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						自定义背景壁纸、动态主题色彩与播放界面个性化装扮
					</p>
				</div>
				<button
					onClick={handleReset}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-foreground transition-colors"
				>
					<RefreshCw className="w-3.5 h-3.5" />
					<span>恢复默认配色</span>
				</button>
			</div>

			{/* Section 1: Custom Background Wallpaper Card */}
			<div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-lg space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<ImageIcon className="w-4 h-4 text-[#00AEEC]" />
						<span className="text-xs font-bold text-foreground">
							全景自定义背景壁纸
						</span>
					</div>
					{customBgUrl && (
						<button
							onClick={clearCustomBg}
							className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
						>
							<Trash2 className="w-3.5 h-3.5" />
							<span>清除壁纸</span>
						</button>
					)}
				</div>

				<div className="flex flex-col md:flex-row gap-5 items-start">
					{/* Wallpaper Preview Area */}
					<div className="w-full md:w-56 h-32 rounded-xl bg-black/40 border border-white/10 overflow-hidden relative flex-shrink-0 flex items-center justify-center">
						{customBgUrl ? (
							<img
								src={customBgUrl}
								alt="Custom Background"
								className="w-full h-full object-cover transition-all"
								style={{
									opacity: customBgOpacity,
									filter: customBgBlur ? `blur(${customBgBlur}px)` : 'none',
								}}
							/>
						) : (
							<div className="text-center text-muted-foreground/60 space-y-1">
								<ImageIcon className="w-6 h-6 mx-auto opacity-50" />
								<p className="text-[10px]">当前未设置背景壁纸</p>
							</div>
						)}
					</div>

					{/* Controls: Upload & Sliders */}
					<div className="flex-1 w-full space-y-3.5 text-xs">
						<div className="flex flex-wrap items-center gap-2.5">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={handleFileUpload}
								className="hidden"
							/>
							<button
								onClick={() => fileInputRef.current?.click()}
								className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00AEEC] hover:bg-[#1dbefa] text-white font-semibold transition-all shadow-md shadow-[#00AEEC]/20 active:scale-95"
							>
								<Upload className="w-3.5 h-3.5" />
								<span>上传本地图片</span>
							</button>

							{/* UI 字体颜色选项（紧凑设计） */}
							<div className="flex-1 flex items-center justify-between gap-1.5 min-w-[240px] h-8 px-2.5 rounded-lg bg-white/5 border border-white/10">
								<div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
									<Type className="w-3 h-3 text-[#00AEEC]" />
									<span className="text-[10px] font-medium text-foreground">
										字体颜色
									</span>
								</div>

								<div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
									{FONT_COLOR_PRESETS.map((item) => {
										const isSelected =
											customTextColor?.toLowerCase() === item.color.toLowerCase() ||
											(!customTextColor && item.color === '#FFFFFF')
										return (
											<button
												key={item.color}
												onClick={() =>
													handleSetFontColor(item.color === '#FFFFFF' ? null : item.color)
												}
												title={item.name}
												className={`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center flex-shrink-0 ${
													isSelected
														? 'ring-1.5 ring-primary ring-offset-1 ring-offset-[#0b0f17] scale-110 border-white'
														: 'border-white/20 hover:scale-105'
												}`}
												style={{ backgroundColor: item.color }}
											>
												{isSelected && (
													<Check className="w-2 h-2 text-black stroke-[3]" />
												)}
											</button>
										)
									})}

									{/* 自定义拾色器 */}
									<label
										title="取色器自定义"
										className="w-3.5 h-3.5 rounded-full border border-dashed border-white/40 hover:border-white/80 cursor-pointer flex items-center justify-center relative overflow-hidden transition-all hover:scale-105 flex-shrink-0"
										style={{ backgroundColor: customTextColor || 'transparent' }}
									>
										<input
											type="color"
											value={customTextColor || '#FFFFFF'}
											onChange={(e) => handleSetFontColor(e.target.value)}
											className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
										/>
										<Pipette className="w-2 h-2 text-white/80 pointer-events-none" />
									</label>

									{customTextColor && (
										<button
											onClick={() => handleSetFontColor(null)}
											className="text-[9px] text-muted-foreground hover:text-white px-1 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
											title="重置为默认字体颜色"
										>
											重置
										</button>
									)}
								</div>
							</div>
						</div>

						{/* Sliders for Opacity & Blur */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
							{/* Opacity Slider */}
							<div className="space-y-1.5">
								<div className="flex items-center justify-between text-[11px] text-muted-foreground">
									<span>背景不透明度</span>
									<span className="font-mono text-foreground font-semibold">
										{Math.round((customBgOpacity ?? 0.5) * 100)}%
									</span>
								</div>
								<input
									type="range"
									min="0.1"
									max="1"
									step="0.05"
									value={customBgOpacity ?? 0.5}
									onChange={(e) =>
										setCustomBg(
											customBgUrl,
											parseFloat(e.target.value),
											customBgBlur ?? 0,
										)
									}
									className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#00AEEC]"
								/>
							</div>

							{/* Blur Slider */}
							<div className="space-y-1.5">
								<div className="flex items-center justify-between text-[11px] text-muted-foreground">
									<span>毛玻璃模糊度</span>
									<span className="font-mono text-foreground font-semibold">
										{customBgBlur ?? 0}px
									</span>
								</div>
								<input
									type="range"
									min="0"
									max="30"
									step="1"
									value={customBgBlur ?? 0}
									onChange={(e) =>
										setCustomBg(
											customBgUrl,
											customBgOpacity ?? 0.5,
											parseInt(e.target.value, 10),
										)
									}
									className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#00AEEC]"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Section 2: Preset Theme Garb Suits */}
			<div className="space-y-3">
				<h3 className="text-xs font-bold text-foreground">
					预设主题装扮
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{PRESET_SKINS.map((skin) => {
						const isActive = activeSkinId === skin.id
						return (
							<div
								key={skin.id}
								className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
									isActive
										? 'bg-primary/10 border-primary/50 shadow-lg'
										: 'bg-white/5 border-white/5 hover:border-white/15'
								}`}
							>
								<div className="flex items-center gap-3.5 overflow-hidden">
									<div
										className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md flex-shrink-0"
										style={{ backgroundColor: skin.color }}
									>
										<Sparkles className="w-6 h-6" />
									</div>
									<div className="overflow-hidden">
										<div className="flex items-center gap-2">
											<p className="text-xs font-bold text-foreground">
												{skin.name}
											</p>
											<span
												className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
												style={{ backgroundColor: skin.color }}
											/>
										</div>
										<p className="text-[11px] text-muted-foreground truncate mt-0.5">
											{skin.description}
										</p>
									</div>
								</div>

								<button
									onClick={() => handleApplyPreset(skin)}
									className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
										isActive
											? 'bg-primary text-white shadow-md'
											: 'bg-white/10 hover:bg-white/15 text-foreground'
									}`}
								>
									{isActive ? (
										<>
											<Check className="w-3.5 h-3.5" />
											<span>使用中</span>
										</>
									) : (
										<span>应用</span>
									)}
								</button>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
