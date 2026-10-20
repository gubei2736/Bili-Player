import React, { useState, useEffect } from 'react'
import { Languages } from 'lucide-react'
import {
	getAutoMatchLyricsEnabled,
	setAutoMatchLyricsEnabled,
	getLyricOptionTranslation,
	setLyricOptionTranslation,
	getLyricOptionRomaji,
	setLyricOptionRomaji,
	getPreferredLyricSource,
	setPreferredLyricSource,
	type PreferredLyricSource,
} from '../../services/lyricService'

export const LyricsSettingsCard: React.FC = () => {
	const [autoMatch, setAutoMatch] = useState<boolean>(getAutoMatchLyricsEnabled())
	const [showTranslation, setShowTranslation] = useState<boolean>(getLyricOptionTranslation())
	const [showRomaji, setShowRomaji] = useState<boolean>(getLyricOptionRomaji())
	const [preferredSource, setPreferredSource] = useState<PreferredLyricSource>(() => getPreferredLyricSource())

	useEffect(() => {
		const handleAutoMatchChange = (e: any) => {
			setAutoMatch(e.detail?.enabled ?? getAutoMatchLyricsEnabled())
		}
		const handlePreferredSourceChange = (e: any) => {
			setPreferredSource(e.detail?.source ?? getPreferredLyricSource())
		}
		window.addEventListener('bbplayer:auto-match-lyrics-change', handleAutoMatchChange)
		window.addEventListener('bbplayer:preferred-lyric-source-change', handlePreferredSourceChange)
		return () => {
			window.removeEventListener('bbplayer:auto-match-lyrics-change', handleAutoMatchChange)
			window.removeEventListener('bbplayer:preferred-lyric-source-change', handlePreferredSourceChange)
		}
	}, [])

	const handleToggleAutoMatch = (checked: boolean) => {
		setAutoMatch(checked)
		setAutoMatchLyricsEnabled(checked)
	}

	const handleToggleTranslation = (checked: boolean) => {
		setShowTranslation(checked)
		setLyricOptionTranslation(checked)
	}

	const handleToggleRomaji = (checked: boolean) => {
		setShowRomaji(checked)
		setLyricOptionRomaji(checked)
	}

	const handleChangePreferredSource = (src: PreferredLyricSource) => {
		setPreferredSource(src)
		setPreferredLyricSource(src)
	}

	return (
		<div className="rounded-xl bg-white/5 p-4 border border-white/5 text-xs space-y-4">
			<div className="flex items-center justify-between pb-1 border-b border-white/5">
				<div className="flex items-center gap-2">
					<div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
						<Languages className="w-3.5 h-3.5" />
					</div>
					<div>
						<p className="font-semibold text-foreground">歌词功能设置</p>
						<p className="text-[11px] text-muted-foreground">
							配置歌词自动检索与多语言拓展展示策略
						</p>
					</div>
				</div>
			</div>

			<div className="space-y-3 pt-1">
				{/* 1. 自动在线匹配歌词开关 */}
				<div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
					<div className="space-y-0.5">
						<div className="flex items-center gap-2">
							<span className="font-semibold text-foreground">自动在线匹配歌词</span>
							{autoMatch && (
								<span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
									开启
								</span>
							)}
						</div>
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							切歌或播放新曲目时，自动从 QQ 音乐与网易云曲库检索匹配桌面与底栏歌词。关闭后切歌不发起网络请求，仅展示用户保存的自定义歌词或手动搜索。
						</p>
					</div>
					<button
						type="button"
						role="switch"
						aria-checked={autoMatch}
						onClick={() => handleToggleAutoMatch(!autoMatch)}
						className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
							autoMatch ? 'bg-[#00AEEC]' : 'bg-white/20'
						}`}
					>
						<span
							className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
								autoMatch ? 'translate-x-4' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>

				{/* 2. 优先歌词检索来源 */}
				<div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
					<div className="space-y-0.5">
						<span className="font-semibold text-foreground">优先歌词检索音源</span>
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							选择默认首选检索的歌词数据库，若首选音源无歌词则自动降级从备选音源获取。
						</p>
					</div>
					<div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/5 shrink-0">
						<button
							type="button"
							onClick={() => handleChangePreferredSource('qq')}
							className={`px-2.5 py-1 text-[11px] rounded-lg transition-all ${
								preferredSource === 'qq'
									? 'bg-emerald-600 text-white shadow-sm font-semibold'
									: 'text-muted-foreground hover:text-emerald-400'
							}`}
						>
							QQ 音乐
						</button>
						<button
							type="button"
							onClick={() => handleChangePreferredSource('netease')}
							className={`px-2.5 py-1 text-[11px] rounded-lg transition-all ${
								preferredSource === 'netease'
									? 'bg-red-600 text-white shadow-sm font-semibold'
									: 'text-muted-foreground hover:text-red-400'
							}`}
						>
							网易云音乐
						</button>
						<button
							type="button"
							onClick={() => handleChangePreferredSource('all')}
							className={`px-2.5 py-1 text-[11px] rounded-lg transition-all ${
								preferredSource === 'all'
									? 'bg-primary text-white shadow-sm font-semibold'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							聚合全部
						</button>
					</div>
				</div>

				{/* 3. 歌词中文翻译开关 */}
				<div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
					<div className="space-y-0.5">
						<span className="font-semibold text-foreground">外语歌词中文翻译</span>
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							针对日、韩、英等外语歌曲，优先检索并显示对应的中文逐句翻译歌词。
						</p>
					</div>
					<button
						type="button"
						role="switch"
						aria-checked={showTranslation}
						onClick={() => handleToggleTranslation(!showTranslation)}
						className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
							showTranslation ? 'bg-[#00AEEC]' : 'bg-white/20'
						}`}
					>
						<span
							className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
								showTranslation ? 'translate-x-4' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>

				{/* 4. 罗马音注音开关 */}
				<div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
					<div className="space-y-0.5">
						<span className="font-semibold text-foreground">日韩语罗马音注音</span>
						<p className="text-[11px] text-muted-foreground leading-relaxed">
							在日韩语等歌曲的原词上方附加显示对应的罗马音音标，方便跟唱学习。
						</p>
					</div>
					<button
						type="button"
						role="switch"
						aria-checked={showRomaji}
						onClick={() => handleToggleRomaji(!showRomaji)}
						className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
							showRomaji ? 'bg-[#00AEEC]' : 'bg-white/20'
						}`}
					>
						<span
							className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
								showRomaji ? 'translate-x-4' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>
			</div>
		</div>
	)
}
