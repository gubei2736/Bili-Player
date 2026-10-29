export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const EQ_FREQ_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'] as const

export interface EQPreset {
	id: string
	name: string
	gains: number[] // 10 values in range [-12, +12]
	desc: string
}

export const EQ_PRESETS: EQPreset[] = [
	{
		id: 'flat',
		name: '默认平直',
		gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		desc: '',
	},
	{
		id: 'vocal',
		name: '人声增强',
		gains: [-1.5, -1.0, 0, 1.5, 3.5, 4.5, 3.5, 2.0, 1.0, 0],
		desc: '突出中频人声清晰度，削弱低音轰鸣，翻唱与播客必备',
	},
	{
		id: 'treble',
		name: '清亮通透',
		gains: [-1.0, -0.5, 0, 0, 0.5, 1.5, 3.0, 4.5, 4.0, 3.0],
		desc: '提升高频泛音与空气感，乐器声线更明亮分明',
	},
	{
		id: 'bass',
		name: '澎湃低音',
		gains: [6.0, 5.0, 3.5, 2.0, 0.5, 0, 0, 0, 0, 0],
		desc: '增强次低频与打击感，适合电音、舞曲与重低音',
	},
	{
		id: 'pop',
		name: '温暖流行',
		gains: [1.5, 2.5, 2.0, 1.0, 1.5, 2.5, 3.0, 2.5, 1.5, 0.5],
		desc: '温润耐听的微 V 曲线，兼顾节奏感与人声耐听度',
	},
	{
		id: 'classical',
		name: '古典交响',
		gains: [3.5, 3.0, 2.0, 0, -1.0, 0, 1.5, 2.5, 3.5, 3.0],
		desc: '强化大动态声场与交响管弦乐声部层次感',
	},
	{
		id: 'rock',
		name: '摇滚动感',
		gains: [4.5, 3.5, 2.0, -0.5, -1.5, 1.0, 2.5, 3.5, 4.0, 4.5],
		desc: '增强贝斯、电吉他扫弦与底鼓打击力度',
	},
	{
		id: 'custom',
		name: '自定义',
		gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		desc: '自由微调每个频段增益',
	},
]

export type SpatialDeviceType = 'headphone' | 'speaker'
export type SpatialHeadphoneMode = 'hrtf' | 'dts' | 'hesuvi'

export interface EqualizerSettings {
	enabled: boolean
	presetId: string
	gains: number[]
	vocalEnhancerEnabled: boolean
	vocalEnhancerIntensity: number // dB, default 3.5
	crossfeedEnabled: boolean
	crossfadeEnabled: boolean
	crossfadeDuration: number // seconds, default 1.2
	// 全景环绕配置
	spatialSurroundEnabled: boolean
	spatialDeviceType: SpatialDeviceType
	spatialHeadphoneMode: SpatialHeadphoneMode
	spatialSpeakerWidening: number // 0.0 ~ 1.0, 电脑音箱立体声拉宽程度
	spatialSpeakerCrossDelay: number // 0.0 ~ 1.0, 电脑音箱轻微交叉延迟深度
}

export const DEFAULT_EQ_SETTINGS: EqualizerSettings = {
	enabled: false,
	presetId: 'flat',
	gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	vocalEnhancerEnabled: false,
	vocalEnhancerIntensity: 3.5,
	crossfeedEnabled: false,
	crossfadeEnabled: true,
	crossfadeDuration: 1.2,
	spatialSurroundEnabled: false,
	spatialDeviceType: 'headphone',
	spatialHeadphoneMode: 'dts',
	spatialSpeakerWidening: 0.6,
	spatialSpeakerCrossDelay: 0.4,
}

const EQ_STORAGE_KEY = 'bbplayer_equalizer_settings_v1'

export function getEqualizerSettings(): EqualizerSettings {
	try {
		const raw = localStorage.getItem(EQ_STORAGE_KEY)
		if (raw) {
			const parsed = JSON.parse(raw)
			return {
				...DEFAULT_EQ_SETTINGS,
				...parsed,
				gains:
					Array.isArray(parsed.gains) && parsed.gains.length === 10
						? parsed.gains
						: [...DEFAULT_EQ_SETTINGS.gains],
			}
		}
	} catch {}
	return { ...DEFAULT_EQ_SETTINGS }
}

export function saveEqualizerSettings(settings: EqualizerSettings): void {
	try {
		localStorage.setItem(EQ_STORAGE_KEY, JSON.stringify(settings))
		if (typeof window !== 'undefined') {
			window.dispatchEvent(
				new CustomEvent('bbplayer:equalizer-changed', { detail: settings }),
			)
		}
	} catch {}
}

export const MAX_CUSTOM_PRESETS = 6
export const CUSTOM_PRESETS_STORAGE_KEY = 'bbplayer_custom_eq_presets_v1'

export function getCustomPresets(): EQPreset[] {
	try {
		const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY)
		if (raw) {
			const parsed = JSON.parse(raw)
			if (Array.isArray(parsed)) {
				return parsed
					.filter(
						(p) =>
							p &&
							typeof p.id === 'string' &&
							typeof p.name === 'string' &&
							Array.isArray(p.gains) &&
							p.gains.length === 10,
					)
					.slice(0, MAX_CUSTOM_PRESETS)
			}
		}
	} catch {}
	return []
}

export function saveCustomPreset(
	name: string,
	gains: number[],
): { success: boolean; preset?: EQPreset; message?: string } {
	try {
		const current = getCustomPresets()
		if (current.length >= MAX_CUSTOM_PRESETS) {
			return {
				success: false,
				message: `自定义预设最多只能保存 ${MAX_CUSTOM_PRESETS} 条，请先删除不需要的预设`,
			}
		}
		const trimmedName = name.trim() || `自定义预设 ${current.length + 1}`
		const newPreset: EQPreset = {
			id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			name: trimmedName,
			gains: [...gains],
			desc: '用户自定义均衡器参数',
		}
		const updated = [...current, newPreset]
		localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated))
		return { success: true, preset: newPreset }
	} catch (e: any) {
		return { success: false, message: e?.message || '保存预设失败' }
	}
}

export function updateCustomPreset(
	id: string,
	name: string,
	gains: number[],
): { success: boolean; preset?: EQPreset; message?: string } {
	try {
		const current = getCustomPresets()
		const idx = current.findIndex((p) => p.id === id)
		if (idx === -1) {
			return { success: false, message: '未找到对应预设' }
		}
		const updatedItem: EQPreset = {
			...current[idx],
			name: name.trim() || current[idx].name,
			gains: [...gains],
		}
		current[idx] = updatedItem
		localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(current))
		return { success: true, preset: updatedItem }
	} catch (e: any) {
		return { success: false, message: e?.message || '更新预设失败' }
	}
}

export function deleteCustomPreset(id: string): void {
	try {
		const current = getCustomPresets()
		const filtered = current.filter((p) => p.id !== id)
		localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(filtered))
	} catch {}
}
