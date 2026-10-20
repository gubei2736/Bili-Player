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
		desc: '原汁原味，无任何频段增益渲染',
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

export interface EqualizerSettings {
	enabled: boolean
	presetId: string
	gains: number[]
	vocalEnhancerEnabled: boolean
	vocalEnhancerIntensity: number // dB, default 3.5
	crossfeedEnabled: boolean
	crossfadeEnabled: boolean
	crossfadeDuration: number // seconds, default 1.2
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
