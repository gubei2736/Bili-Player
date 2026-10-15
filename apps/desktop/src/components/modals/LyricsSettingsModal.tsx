import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
	X,
	FileText,
	Search,
	Check,
	RotateCcw,
	Loader2,
	Save,
	Languages,
} from 'lucide-react'
import type { Track } from '@bbplayer/shared-core'
import {
	lyricService,
	getStoredLyricOffset,
	setStoredLyricOffset,
	getStoredCustomLyric,
	setStoredCustomLyric,
	getLyricOptionTranslation,
	setLyricOptionTranslation,
	getLyricOptionRomaji,
	setLyricOptionRomaji,
	cleanTrackTitle,
	type LyricSearchCandidate,
} from '../../services/lyricService'

export interface LyricsSettingsModalProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
	onLyricsUpdated?: (splContent: string) => void
}

export const LyricsSettingsModal: React.FC<LyricsSettingsModalProps> = ({
	isOpen,
	onClose,
	track,
	onLyricsUpdated,
}) => {
	const [activeTab, setActiveTab] = useState<'search' | 'custom' | 'offset'>('search')
	const [searchKeyword, setSearchKeyword] = useState('')
	const [candidates, setCandidates] = useState<LyricSearchCandidate[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [customText, setCustomText] = useState('')
	const [offsetSec, setOffsetSec] = useState(0)
	const [loadingCandidateId, setLoadingCandidateId] = useState<string | number | null>(null)
	const [successMsg, setSuccessMsg] = useState<string | null>(null)
	const [includeTranslation, setIncludeTranslation] = useState(() => getLyricOptionTranslation())
	const [includeRomaji, setIncludeRomaji] = useState(() => getLyricOptionRomaji())
	const [hasSearched, setHasSearched] = useState(false)

	const handleSearch = async (kw: string) => {
		if (!kw.trim()) return
		setIsSearching(true)
		setHasSearched(true)
		try {
			const results = await lyricService.searchCandidates(kw.trim())
			setCandidates(results)
			// 立即在后台并行预加载候选歌词，用户点击时直接命中内存，瞬间完成采用！
			if (track) {
				lyricService.prefetchCandidates(results, track.uniqueKey)
			}
		} catch (err) {
			console.warn('Search lyrics error:', err)
		} finally {
			setIsSearching(false)
		}
	}

	useEffect(() => {
		if (isOpen && track) {
			const bili = track.source === 'bilibili' ? (track as any) : null
			// 优先使用当前分 P 标题，避免分 P 视频直接显示总合集标题
			const rawTitle =
				bili?.bilibiliMetadata?.isMultiPage && bili?.bilibiliMetadata?.pagePart
					? bili.bilibiliMetadata.pagePart
					: track.title

			let kw = cleanTrackTitle(rawTitle) || rawTitle

			// 若分 P 标题自身未包含歌手名字，且主标题包含歌手名（如 "陶喆 录音室作品"），智能补齐歌手名
			if (bili?.bilibiliMetadata?.mainTrackTitle) {
				const mainClean = cleanTrackTitle(bili.bilibiliMetadata.mainTrackTitle)
				const possibleArtist = mainClean.split(/[\s·-]+/)[0]
				if (possibleArtist && !kw.includes(possibleArtist) && possibleArtist.length >= 2) {
					kw = `${kw} ${possibleArtist}`.trim()
				}
			}

			setSearchKeyword(kw)
			setOffsetSec(getStoredLyricOffset(track.uniqueKey))
			setCustomText(getStoredCustomLyric(track.uniqueKey) || '')
			setCandidates([])
			setIsSearching(false)
			setHasSearched(false)

			if (kw) {
				handleSearch(kw)
			}
		}
	}, [isOpen, track?.uniqueKey])

	if (!isOpen || !track) return null

	const handleApplyCandidate = async (candidate: LyricSearchCandidate) => {
		setLoadingCandidateId(candidate.id)
		try {
			const spl = await lyricService.fetchCandidateLyrics(
				candidate,
				{
					showTranslation: includeTranslation,
					showRomaji: includeRomaji,
				},
				track.uniqueKey,
			)
			if (spl) {
				setStoredCustomLyric(track.uniqueKey, spl)
				setCustomText(spl)
				onLyricsUpdated?.(spl)
				setSuccessMsg(`已成功应用【${candidate.title}】的歌词！`)
				setTimeout(() => setSuccessMsg(null), 2000)
			}
		} catch (err) {
			console.error('Failed to apply lyrics:', err)
		} finally {
			setLoadingCandidateId(null)
		}
	}

	const handleToggleTranslation = async (enabled: boolean) => {
		setIncludeTranslation(enabled)
		setLyricOptionTranslation(enabled)
		await handleApplyOptions({ showTranslation: enabled, showRomaji: includeRomaji })
	}

	const handleToggleRomaji = async (enabled: boolean) => {
		setIncludeRomaji(enabled)
		setLyricOptionRomaji(enabled)
		await handleApplyOptions({ showTranslation: includeTranslation, showRomaji: enabled })
	}

	const handleApplyOptions = async (opts: {
		showTranslation: boolean
		showRomaji: boolean
	}) => {
		if (!track) return
		try {
			// 1. 优先内存中毫秒级重算，避免重新请求网络
			let spl = lyricService.reapplyOptions(track.uniqueKey, opts)
			if (!spl) {
				// 2. 兜底回源重新获取并解析
				const res = await lyricService.fetchLyricForTrack(track, true, opts)
				spl = res?.splContent || null
			}
			if (spl) {
				setStoredCustomLyric(track.uniqueKey, spl)
				setCustomText(spl)
				onLyricsUpdated?.(spl)
				setSuccessMsg(
					`歌词已更新：${opts.showTranslation ? '已开启' : '已关闭'}翻译，${opts.showRomaji ? '已开启' : '已关闭'}罗马音`,
				)
				setTimeout(() => setSuccessMsg(null), 2500)
			}
		} catch (err) {
			console.error('Refresh lyrics with new options failed:', err)
		}
	}

	const handleSaveCustom = () => {
		if (!customText.trim()) return
		setStoredCustomLyric(track.uniqueKey, customText.trim())
		onLyricsUpdated?.(customText.trim())
		setSuccessMsg('已保存自定义歌词！')
		setTimeout(() => setSuccessMsg(null), 2000)
	}

	const handleAdjustOffset = (deltaSec: number) => {
		const next = Math.round((offsetSec + deltaSec) * 10) / 10
		setOffsetSec(next)
		setStoredLyricOffset(track.uniqueKey, next)
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyric-offset-change', {
				detail: { trackKey: track.uniqueKey, offsetSec: next },
			}),
		)
	}

	const handleResetOffset = () => {
		setOffsetSec(0)
		setStoredLyricOffset(track.uniqueKey, 0)
		window.dispatchEvent(
			new CustomEvent('bbplayer:lyric-offset-change', {
				detail: { trackKey: track.uniqueKey, offsetSec: 0 },
			}),
		)
	}

	return createPortal(
		<div className="fixed inset-0 z-[999] overflow-hidden select-none">
			{/* Backdrop overlay */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
				onClick={onClose}
			/>

			{/* Slide-out Sidebar Drawer */}
			<div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
				<div className="w-screen max-w-md sm:max-w-lg bg-background/95 border-l border-white/10 shadow-2xl flex flex-col p-6 space-y-4 backdrop-blur-xl animate-in slide-in-from-right duration-300">
					{/* Header */}
					<div className="flex items-center justify-between pb-3 border-b border-white/5">
						<div className="flex items-center gap-2.5">
							<div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-sm shadow-primary/20">
								<FileText className="w-4 h-4" />
							</div>
							<div>
								<h3 className="text-sm font-bold text-foreground">
									歌词管理与微调
								</h3>
								<p className="text-[11px] text-muted-foreground truncate max-w-[260px] sm:max-w-xs mt-0.5" title={track.source === 'bilibili' && (track as any)?.bilibiliMetadata?.isMultiPage && (track as any)?.bilibiliMetadata?.pagePart ? `[P${(track as any).bilibiliMetadata.pageIndex || 1}] ${(track as any).bilibiliMetadata.pagePart}` : track.title}>
									{track.source === 'bilibili' && (track as any)?.bilibiliMetadata?.isMultiPage && (track as any)?.bilibiliMetadata?.pagePart
										? `[P${(track as any).bilibiliMetadata.pageIndex || 1}] ${(track as any).bilibiliMetadata.pagePart}`
										: track.title}
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					{/* Tabs */}
					<div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/5">
						<button
							onClick={() => setActiveTab('search')}
							className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
								activeTab === 'search'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							智能搜索匹配
						</button>
						<button
							onClick={() => setActiveTab('custom')}
							className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
								activeTab === 'custom'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							粘贴 LRC/SPL
						</button>
						<button
							onClick={() => setActiveTab('offset')}
							className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
								activeTab === 'offset'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							时间微调 ({offsetSec >= 0 ? `+${offsetSec}` : offsetSec}s)
						</button>
					</div>

					{/* Multi-language & Romaji Toggle Bar */}
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
						<div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
							<Languages className="w-3.5 h-3.5 text-[#00AEEC]" />
							<span>歌词呈现选项：</span>
						</div>
						<div className="flex items-center gap-4">
							<label className="flex items-center gap-1.5 cursor-pointer text-foreground hover:text-[#00AEEC] transition-colors select-none">
								<input
									type="checkbox"
									checked={includeTranslation}
									onChange={(e) => handleToggleTranslation(e.target.checked)}
									className="w-3.5 h-3.5 rounded border-white/20 text-[#00AEEC] focus:ring-0 cursor-pointer accent-[#00AEEC]"
								/>
								<span className="text-[11px] font-medium">翻译歌词</span>
							</label>

							<label className="flex items-center gap-1.5 cursor-pointer text-foreground hover:text-[#00AEEC] transition-colors select-none">
								<input
									type="checkbox"
									checked={includeRomaji}
									onChange={(e) => handleToggleRomaji(e.target.checked)}
									className="w-3.5 h-3.5 rounded border-white/20 text-[#00AEEC] focus:ring-0 cursor-pointer accent-[#00AEEC]"
								/>
								<span className="text-[11px] font-medium">罗马音 / 注音</span>
							</label>
						</div>
					</div>

					{/* Success Notification */}
					{successMsg && (
						<div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
							<Check className="w-3.5 h-3.5 flex-shrink-0" />
							<span>{successMsg}</span>
						</div>
					)}

					{/* Tab 1: Search */}
					{activeTab === 'search' && (
						<div className="flex-1 flex flex-col min-h-0 space-y-3">
							<div className="flex items-center gap-2">
								<input
									type="text"
									value={searchKeyword}
									onChange={(e) => setSearchKeyword(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchKeyword)}
									placeholder="输入歌曲名 / 歌手重新搜索歌词..."
									className="flex-1 h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none transition-all"
								/>
								<button
									onClick={() => handleSearch(searchKeyword)}
									disabled={isSearching}
									className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
								>
									{isSearching ? (
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
									) : (
										<Search className="w-3.5 h-3.5" />
									)}
									<span>搜索</span>
								</button>
							</div>

							<div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
								{isSearching ? (
									<div className="py-16 text-center space-y-2 text-xs text-muted-foreground">
										<Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
									</div>
								) : hasSearched && candidates.length === 0 ? (
									<div className="py-16 text-center text-xs text-muted-foreground">
										未找到匹配歌词，可尝试修改关键词或点击上方“粘贴 LRC/SPL”自定义
									</div>
								) : candidates.length === 0 ? (
									<div className="py-16 text-center text-xs text-muted-foreground">
										输入关键词后点击“搜索”或回车检索歌词库，也可点击上方“粘贴 LRC/SPL”自定义
									</div>
								) : (
									candidates.map((item) => (
										<div
											key={`${item.source}_${item.id}`}
											className="p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 flex items-center justify-between gap-3 text-xs transition-colors group"
										>
											<div className="overflow-hidden space-y-1 flex-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold text-foreground truncate max-w-[220px]" title={item.title}>
														{item.title}
													</span>
													<span
														className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
															item.source === 'netease'
																? 'bg-red-500/20 text-red-300'
																: 'bg-emerald-500/20 text-emerald-300'
														}`}
													>
														{item.source === 'netease' ? '网易云 (逐字)' : 'QQ音乐'}
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground truncate">
													歌手: {item.artist || '未知'}
												</p>
											</div>

											<button
												onClick={() => handleApplyCandidate(item)}
												disabled={loadingCandidateId === item.id}
												className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
											>
												{loadingCandidateId === item.id && (
													<Loader2 className="w-3 h-3 animate-spin" />
												)}
												<span>采用</span>
											</button>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{/* Tab 2: Custom Text */}
					{activeTab === 'custom' && (
						<div className="flex-1 flex flex-col min-h-0 space-y-3">
							<p className="text-xs text-muted-foreground leading-relaxed">
								支持直接粘贴标准 LRC 文本或包含逐字进度的 SPL (Salt Player Lyrics) 规范文本：
							</p>
							<textarea
								value={customText}
								onChange={(e) => setCustomText(e.target.value)}
								placeholder="例如:&#10;[00:00.00]歌曲开始&#10;[00:04.20]<00:04.20>逐<00:04.50>字<00:05.00>进<00:05.50>度"
								className="flex-1 w-full p-3 text-xs font-mono rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed min-h-[260px]"
							/>
							<div className="flex justify-end pt-2">
								<button
									onClick={handleSaveCustom}
									disabled={!customText.trim()}
									className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow flex items-center gap-1.5 transition-colors disabled:opacity-50"
								>
									<Save className="w-3.5 h-3.5" />
									<span>保存并应用歌词</span>
								</button>
							</div>
						</div>
					)}

					{/* Tab 3: Offset Adjust */}
					{activeTab === 'offset' && (
						<div className="space-y-4 py-2">
							<p className="text-xs text-muted-foreground leading-relaxed">
								当音频片头片尾导致歌词与声音不同步时，可按需微调时间轴偏移量：
							</p>

							<div className="text-center py-6 bg-white/[0.02] rounded-xl border border-white/5 space-y-1">
								<span className="text-2xl font-bold font-mono text-primary">
									{offsetSec >= 0 ? `+${offsetSec.toFixed(2)}` : offsetSec.toFixed(2)} 秒
								</span>
								<p className="text-[11px] text-muted-foreground">
									{offsetSec > 0 ? '歌词提前显示' : offsetSec < 0 ? '歌词延后显示' : '标准同步'}
								</p>
							</div>

							<div className="grid grid-cols-5 gap-2">
								<button
									onClick={() => handleAdjustOffset(-0.5)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									-0.5s
								</button>
								<button
									onClick={() => handleAdjustOffset(-0.1)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									-0.1s
								</button>
								<button
									onClick={handleResetOffset}
									className="py-2.5 text-xs rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 font-medium flex items-center justify-center gap-1 transition-colors"
								>
									<RotateCcw className="w-3 h-3" />
									<span>重置</span>
								</button>
								<button
									onClick={() => handleAdjustOffset(0.1)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									+0.1s
								</button>
								<button
									onClick={() => handleAdjustOffset(0.5)}
									className="py-2.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono transition-colors"
								>
									+0.5s
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>,
		document.body,
	)
}