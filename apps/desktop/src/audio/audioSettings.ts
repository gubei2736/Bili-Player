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

export function getQualityBadgeInfo(
	qualityId?: number,
	isLocal = false,
	bandwidth?: number,
): {
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

	const measuredKbps = bandwidth ? Math.round(bandwidth / 1000) : null

	switch (qualityId) {
		case 30251:
			return {
				text: 'Hi-Res 无损',
				bg: 'bg-amber-500/20',
				border: 'border-amber-400/30',
				color: 'text-amber-300',
				tooltip: measuredKbps
					? `FLAC 无损音轨 (${measuredKbps}Kbps, 最高 96kHz/24bit)`
					: 'FLAC 无损音轨 (最高 96kHz/24bit)',
			}
		case 30250:
			return {
				text: '杜比全景声',
				bg: 'bg-purple-500/20',
				border: 'border-purple-400/30',
				color: 'text-purple-300',
				tooltip: measuredKbps
					? `Dolby Atmos (${measuredKbps}Kbps E-AC-3 JOC)`
					: 'Dolby Atmos (E-AC-3 JOC, 最高 768kbps)',
			}
		case 30280: {
			// B站 30280 为常规高码率档位：日常投稿普遍为 192kbps，高规格投稿可达 320kbps
			let text = '192Kbps AAC'
			if (measuredKbps) {
				if (measuredKbps >= 260) {
					text = '320Kbps AAC'
				} else if (measuredKbps >= 150) {
					text = `${measuredKbps >= 180 && measuredKbps <= 200 ? 192 : measuredKbps}Kbps AAC`
				} else {
					text = `${measuredKbps}Kbps AAC`
				}
			}
			return {
				text,
				bg: 'bg-sky-500/20',
				border: 'border-sky-400/30',
				color: 'text-sky-300',
				tooltip: `高品质常规 AAC (${measuredKbps ? measuredKbps + 'Kbps' : '192~320Kbps'} / ID: 30280)`,
			}
		}
		case 30232: {
			const text = measuredKbps
				? `${measuredKbps >= 125 && measuredKbps <= 140 ? 132 : measuredKbps}Kbps AAC`
				: '132Kbps AAC'
			return {
				text,
				bg: 'bg-teal-500/20',
				border: 'border-teal-400/30',
				color: 'text-teal-300',
				tooltip: `中等品质常规 AAC (${measuredKbps ? measuredKbps + 'Kbps' : '132Kbps'} / ID: 30232)`,
			}
		}
		case 30216: {
			const text = measuredKbps
				? `${measuredKbps >= 60 && measuredKbps <= 70 ? 64 : measuredKbps}Kbps AAC`
				: '64Kbps AAC'
			return {
				text,
				bg: 'bg-zinc-500/20',
				border: 'border-zinc-400/30',
				color: 'text-zinc-300',
				tooltip: `普通品质常规 AAC (${measuredKbps ? measuredKbps + 'Kbps' : '64Kbps'} / ID: 30216)`,
			}
		}
		default:
			return {
				text: '识别音质中...',
				bg: 'bg-white/10',
				border: 'border-white/15',
				color: 'text-muted-foreground animate-pulse',
				tooltip: '正在识别当前音频流真实码率与格式...',
			}
	}
}
