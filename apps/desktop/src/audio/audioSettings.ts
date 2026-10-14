export type AudioQualityPreference = 'auto_hires' | 'high_192k' | 'standard_132k'

const STORAGE_KEY = 'bbplayer_audio_quality_pref'

export function getAudioQualityPreference(): AudioQualityPreference {
	if (typeof window === 'undefined') return 'auto_hires'
	const stored = localStorage.getItem(STORAGE_KEY)
	if (stored === 'high_192k' || stored === 'standard_132k' || stored === 'auto_hires') {
		return stored
	}
	return 'auto_hires'
}

export function setAudioQualityPreference(pref: AudioQualityPreference): void {
	if (typeof window === 'undefined') return
	localStorage.setItem(STORAGE_KEY, pref)
	window.dispatchEvent(new CustomEvent('bbplayer:audio-quality-change', { detail: pref }))
}

export function getQualityBadgeInfo(qualityId?: number): {
	text: string
	bg: string
	border: string
	color: string
} {
	switch (qualityId) {
		case 30251:
			return {
				text: 'Hi-Res 无损',
				bg: 'bg-amber-500/20',
				border: 'border-amber-400/30',
				color: 'text-amber-300',
			}
		case 30250:
			return {
				text: 'Dolby 全景声',
				bg: 'bg-purple-500/20',
				border: 'border-purple-400/30',
				color: 'text-purple-300',
			}
		case 30280:
			return {
				text: '192K 高保真',
				bg: 'bg-sky-500/20',
				border: 'border-sky-400/30',
				color: 'text-sky-300',
			}
		case 30232:
			return {
				text: '132K 标准',
				bg: 'bg-emerald-500/20',
				border: 'border-emerald-400/30',
				color: 'text-emerald-300',
			}
		case 30216:
			return {
				text: '64K 省流',
				bg: 'bg-zinc-500/20',
				border: 'border-zinc-400/30',
				color: 'text-zinc-300',
			}
		default:
			return {
				text: '192K 高保真',
				bg: 'bg-sky-500/20',
				border: 'border-sky-400/30',
				color: 'text-sky-300',
			}
	}
}
