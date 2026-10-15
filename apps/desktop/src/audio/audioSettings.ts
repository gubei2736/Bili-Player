export type AudioQualityPreference =
	| 'auto_highest'
	| 'hires_lossless'
	| 'dolby_atmos'
	| 'standard_aac'
	| 'auto_hires'
	| 'high_192k'
	| 'standard_132k'

const STORAGE_KEY = 'bbplayer_audio_quality_pref'

export function getAudioQualityPreference(): 'auto_highest' | 'hires_lossless' | 'dolby_atmos' | 'standard_aac' {
	if (typeof window === 'undefined') return 'auto_highest'
	const stored = localStorage.getItem(STORAGE_KEY)
	if (
		stored === 'auto_highest' ||
		stored === 'hires_lossless' ||
		stored === 'dolby_atmos' ||
		stored === 'standard_aac'
	) {
		return stored
	}
	// 兼容旧版配置迁移
	if (stored === 'auto_hires') return 'auto_highest'
	if (stored === 'high_192k' || stored === 'standard_132k') return 'standard_aac'
	return 'auto_highest'
}

export function setAudioQualityPreference(pref: AudioQualityPreference): void {
	if (typeof window === 'undefined') return
	localStorage.setItem(STORAGE_KEY, pref)
	window.dispatchEvent(new CustomEvent('bbplayer:audio-quality-change', { detail: pref }))
}

export function getQualityBadgeInfo(qualityId?: number, isLocal = false): {
	text: string
	bg: string
	border: string
	color: string
	tooltip: string
} {
	if (isLocal) {
		return {
			text: '本地音频',
			bg: 'bg-emerald-500/20',
			border: 'border-emerald-400/30',
			color: 'text-emerald-300',
			tooltip: '本地文件音频',
		}
	}

	switch (qualityId) {
		case 30251:
			return {
				text: 'Hi-Res 无损',
				bg: 'bg-amber-500/20',
				border: 'border-amber-400/30',
				color: 'text-amber-300',
				tooltip: 'FLAC 无损音轨 (最高 96kHz/24bit)',
			}
		case 30250:
			return {
				text: '杜比全景声',
				bg: 'bg-purple-500/20',
				border: 'border-purple-400/30',
				color: 'text-purple-300',
				tooltip: 'Dolby Atmos (E-AC-3 JOC, 最高 768kbps)',
			}
		case 30280:
			return {
				text: '320Kbps AAC',
				bg: 'bg-sky-500/20',
				border: 'border-sky-400/30',
				color: 'text-sky-300',
				tooltip: '320Kbps 极高品质常规 AAC',
			}
		case 30232:
			return {
				text: '132Kbps AAC',
				bg: 'bg-teal-500/20',
				border: 'border-teal-400/30',
				color: 'text-teal-300',
				tooltip: '132Kbps 较高品质常规 AAC',
			}
		case 30216:
			return {
				text: '64Kbps AAC',
				bg: 'bg-zinc-500/20',
				border: 'border-zinc-400/30',
				color: 'text-zinc-300',
				tooltip: '64Kbps 普通品质常规 AAC',
			}
		default:
			return {
				text: '识别音质中...',
				bg: 'bg-white/10',
				border: 'border-white/15',
				color: 'text-muted-foreground animate-pulse',
				tooltip: '正在识别当前音频流码率与格式...',
			}
	}
}
