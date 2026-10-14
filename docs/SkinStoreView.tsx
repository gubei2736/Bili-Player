import React from 'react'
import { Palette, Check, Sparkles, RefreshCw } from 'lucide-react'
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

export const SkinStoreView: React.FC = () => {
	const { activeSkinId, setSkin, clearSkin } = useSkinStore()

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
		document.documentElement.style.setProperty('--primary-rgb', '0 174 236')
		document.documentElement.style.setProperty('--primary', '#00AEEC')
		document.documentElement.style.setProperty('--bili-theme-primary', '#00AEEC')
		document.documentElement.style.setProperty('--ring', '#00AEEC')
	}

	return (
		<div className="space-y-6 max-w-4xl">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-base font-bold text-foreground flex items-center gap-2">
						<Palette className="w-5 h-5 text-primary" />
						<span>B 站装扮主题引擎</span>
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						一键换肤：动态注入 CSS 主题色彩、波浪进度条动态游标挂件与背景
					</p>
				</div>
				<button
					onClick={handleReset}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-foreground transition-colors"
				>
					<RefreshCw className="w-3.5 h-3.5" />
					<span>恢复默认主题</span>
				</button>
			</div>

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
	)
}
