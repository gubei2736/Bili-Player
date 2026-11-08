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
				text: measuredKbps ? `Hi-Res · ${measuredKbps}Kbps` : 'Hi-Res 无损',
				bg: 'bg-amber-500/20',
				border: 'border-amber-400/30',
				color: 'text-amber-300',
				tooltip: measuredKbps
					? `FLAC 无损音轨 (实时流物理带宽: ${measuredKbps}Kbps, 最高 96kHz/24bit)`
					: 'FLAC 无损音轨 (最高 96kHz/24bit)',
			}
		case 30250:
			return {
				text: measuredKbps ? `杜比 · ${measuredKbps}Kbps` : '杜比全景声',
				bg: 'bg-purple-500/20',
				border: 'border-purple-400/30',
				color: 'text-purple-300',
				tooltip: measuredKbps
					? `Dolby Atmos (实时流物理带宽: ${measuredKbps}Kbps E-AC-3 JOC)`
					: 'Dolby Atmos (E-AC-3 JOC, 最高 768kbps)',
			}
		case 30280: {
			// B站 30280 为官方最高常规音频档位 (标称 320Kbps AAC)
			// B站音频采用 AAC-LC VBR 动态压缩编码，在播放栏中直观呈现「320K 档位 · 实时流物理带宽」
			const text = measuredKbps ? `320K · ${measuredKbps}Kbps` : '320Kbps AAC'
			return {
				text,
				bg: 'bg-sky-500/20',
				border: 'border-sky-400/30',
				color: 'text-sky-300',
				tooltip: `高品质常规 AAC · 320K 档位 (${measuredKbps ? `实时流物理带宽: ${measuredKbps}Kbps` : '标称 320Kbps'} / B站音频ID: 30280)`,
			}
		}
		case 30232: {
			const text = measuredKbps ? `132K · ${measuredKbps}Kbps` : '132Kbps AAC'
			return {
				text,
				bg: 'bg-teal-500/20',
				border: 'border-teal-400/30',
				color: 'text-teal-300',
				tooltip: `中等品质常规 AAC · 132K 档位 (${measuredKbps ? `实时流物理带宽: ${measuredKbps}Kbps` : '132Kbps'} / B站音频ID: 30232)`,
			}
		}
		case 30216: {
			const text = measuredKbps ? `64K · ${measuredKbps}Kbps` : '64Kbps AAC'
			return {
				text,
				bg: 'bg-zinc-500/20',
				border: 'border-zinc-400/30',
				color: 'text-zinc-300',
				tooltip: `普通品质常规 AAC · 64K 档位 (${measuredKbps ? `实时流物理带宽: ${measuredKbps}Kbps` : '64Kbps'} / B站音频ID: 30216)`,
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
