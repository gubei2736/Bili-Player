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
	Type,
	Palette,
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
	getPreferredLyricSource,
	setPreferredLyricSource,
	cleanTrackTitle,
	getLyricFontSizes,
	setLyricFontSizes,
	getStoredTrackSearchCache,
	setStoredTrackSearchCache,
	markTrackAdoptedCandidate,
	getLyricsHighlightColor,
	setLyricsHighlightColor,
	getLyricColors,
	setLyricColor,
	resetLyricColors,
	PRESET_LYRICS_COLORS,
	DEFAULT_LYRICS_HIGHLIGHT_COLOR,
	getDesktopLyricsColor,
	setDesktopLyricsColor,
	PRESET_DESKTOP_LYRICS_COLORS,
	DEFAULT_DESKTOP_LYRICS_COLOR,
	type LyricSearchCandidate,
	type PreferredLyricSource,
	type LyricFontSizes,
	type LyricColors,
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
	const [activeTab, setActiveTab] = useState<'search' | 'custom' | 'offset' | 'typography'>('search')
	const [searchKeyword, setSearchKeyword] = useState('')
	const [candidates, setCandidates] = useState<LyricSearchCandidate[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [customText, setCustomText] = useState('')
	const [offsetSec, setOffsetSec] = useState(0)
	const [loadingCandidateId, setLoadingCandidateId] = useState<string | number | null>(null)
	const [adoptedCandidateId, setAdoptedCandidateId] = useState<string | number | null>(null)
	const [adoptedSource, setAdoptedSource] = useState<string | null>(null)
	const [fontSizes, setFontSizes] = useState<LyricFontSizes>(() => getLyricFontSizes())
	const [lyricColors, setLyricColors] = useState<LyricColors>(() => getLyricColors())
	const [activeColorTarget, setActiveColorTarget] = useState<'main' | 'trans' | 'roma'>('main')
	const [successMsg, setSuccessMsg] = useState<string | null>(null)
	const [includeTranslation, setIncludeTranslation] = useState(() => getLyricOptionTranslation())
	const [includeRomaji, setIncludeRomaji] = useState(() => getLyricOptionRomaji())
	const [sourceFilter, setSourceFilter] = useState<PreferredLyricSource>(() => getPreferredLyricSource())
	const [hasSearched, setHasSearched] = useState(false)

	useEffect(() => {
		const handleColorsChange = (e: any) => {
			if (e.detail) {
				setLyricColors(e.detail)
			}
		}
		window.addEventListener('bbplayer:lyric-colors-change', handleColorsChange)
		return () => {
			window.removeEventListener('bbplayer:lyric-colors-change', handleColorsChange)
		}
	}, [])

	const handleSearch = async (kw: string, filter = sourceFilter) => {
		if (!kw.trim()) return
		setIsSearching(true)
		setHasSearched(true)
		try {
			const results = await lyricService.searchCandidates(kw.trim(), filter)
			setCandidates(results)
			// 缓存搜索结果
			if (track) {
				setStoredTrackSearchCache(track.uniqueKey, {
					candidates: results,
					adoptedId: adoptedCandidateId,
					adoptedSource: adoptedSource ?? undefined,
					searchKeyword: kw.trim(),
					updatedAt: Date.now(),
				})
			}
			// 立即在后台并行预加载候选歌词原始数据，用户点击时直接命中内存，瞬间完成采用！
			lyricService.prefetchCandidates(results)
		} catch (err) {
			console.warn('Search lyrics error:', err)
		} finally {
			setIsSearching(false)
		}
	}

	const handleSourceFilterChange = (filter: PreferredLyricSource) => {
		setSourceFilter(filter)
		setPreferredLyricSource(filter)
		if (searchKeyword.trim()) {
			handleSearch(searchKeyword.trim(), filter)
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

			const currentPreferred = getPreferredLyricSource()
			setSourceFilter(currentPreferred)
			setOffsetSec(getStoredLyricOffset(track.uniqueKey))
			setCustomText(getStoredCustomLyric(track.uniqueKey) || '')
			setFontSizes(getLyricFontSizes())
			setLyricColors(getLyricColors())

			// 检查是否已有上次搜索并采用过的记忆缓存！
			const searchCache = getStoredTrackSearchCache(track.uniqueKey)
			if (searchCache && searchCache.candidates && searchCache.candidates.length > 0) {
				setSearchKeyword(searchCache.searchKeyword || kw)
				setCandidates(searchCache.candidates)
				setAdoptedCandidateId(searchCache.adoptedId ?? null)
				setAdoptedSource(searchCache.adoptedSource ?? null)
				setHasSearched(true)
				setIsSearching(false)
				lyricService.prefetchCandidates(searchCache.candidates)
			} else {
				setSearchKeyword(kw)
				setAdoptedCandidateId(null)
				setAdoptedSource(null)
				setCandidates([])
				setIsSearching(false)
				setHasSearched(false)

				if (kw) {
					handleSearch(kw, currentPreferred)
				}
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
				markTrackAdoptedCandidate(track.uniqueKey, candidate, candidates, searchKeyword)
				setAdoptedCandidateId(candidate.id)
				setAdoptedSource(candidate.source)
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
					<div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
						<button
							onClick={() => setActiveTab('search')}
							className={`py-1.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
								activeTab === 'search'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							智能搜索
						</button>
						<button
							onClick={() => setActiveTab('custom')}
							className={`py-1.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
								activeTab === 'custom'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							粘贴歌词
						</button>
						<button
							onClick={() => setActiveTab('offset')}
							className={`py-1.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
								activeTab === 'offset'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							时间微调
						</button>
						<button
							onClick={() => setActiveTab('typography')}
							className={`py-1.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
								activeTab === 'typography'
									? 'bg-primary text-white shadow'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							字号管理
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
								<span className="text-[11px] font-medium">歌词翻译</span>
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
							{/* 音源切换选择栏 */}
							<div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white/[0.03] border border-white/5">
								<span className="text-[11px] text-muted-foreground px-1 font-medium shrink-0">
									检索平台：
								</span>
								<div className="flex items-center gap-1 flex-1 justify-end">
									<button
										type="button"
										onClick={() => handleSourceFilterChange('all')}
										className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
											sourceFilter === 'all'
												? 'bg-primary text-white shadow-sm font-semibold'
												: 'text-muted-foreground hover:text-foreground hover:bg-white/5'
										}`}
									>
										全部音源
									</button>
									<button
										type="button"
										onClick={() => handleSourceFilterChange('qqmusic')}
										className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
											sourceFilter === 'qqmusic'
												? 'bg-emerald-600 text-white shadow-sm font-semibold'
												: 'text-muted-foreground hover:text-emerald-400 hover:bg-white/5'
										}`}
									>
										QQ 音乐
									</button>
									<button
										type="button"
										onClick={() => handleSourceFilterChange('netease')}
										className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
											sourceFilter === 'netease'
												? 'bg-red-600 text-white shadow-sm font-semibold'
												: 'text-muted-foreground hover:text-red-400 hover:bg-white/5'
										}`}
									>
										网易云音乐
									</button>
								</div>
							</div>

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
										未找到匹配歌词，可尝试切换音源平台、修改关键词或点击上方“粘贴 LRC/SPL”自定义
									</div>
								) : candidates.length === 0 ? (
									<div className="py-16 text-center text-xs text-muted-foreground">
										输入关键词后点击“搜索”或回车检索歌词库，也可点击上方“粘贴 LRC/SPL”自定义
									</div>
								) : (
									candidates.map((item) => {
										const isAdopted =
											adoptedCandidateId !== null &&
											String(item.id) === String(adoptedCandidateId) &&
											(!adoptedSource || item.source === adoptedSource)

										return (
											<div
												key={`${item.source}_${item.id}`}
												className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
													isAdopted
														? 'border-primary/60 bg-primary/[0.08] shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] ring-1 ring-primary/40'
														: 'border-white/5 bg-white/[0.02] hover:bg-white/5'
												}`}
											>
												<div className="overflow-hidden space-y-1 flex-1">
													<div className="flex items-center gap-2">
														<span className="font-semibold text-foreground truncate max-w-[200px]" title={item.title}>
															{item.title}
														</span>
														<span
															className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
																item.source === 'netease'
																	? 'bg-red-500/20 text-red-300 border border-red-500/30'
																	: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
															}`}
														>
															{item.source === 'netease' ? '网易云音乐' : 'QQ 音乐'}
														</span>
														{isAdopted && (
															<span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/25 border border-primary/40 text-primary font-bold flex items-center gap-1 shrink-0">
																<Check className="w-3 h-3 stroke-[3]" />
																已采用
															</span>
														)}
													</div>
													<p className="text-[11px] text-muted-foreground truncate">
														歌手: {item.artist || '未知'}
													</p>
												</div>

												<button
													onClick={() => handleApplyCandidate(item)}
													disabled={loadingCandidateId === item.id}
													className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
														isAdopted
															? 'bg-primary text-white shadow-sm hover:bg-primary/90'
															: 'bg-primary/20 hover:bg-primary/30 text-primary'
													}`}
												>
													{loadingCandidateId === item.id ? (
														<Loader2 className="w-3.5 h-3.5 animate-spin" />
													) : isAdopted ? (
														<Check className="w-3.5 h-3.5" />
													) : null}
													<span>{isAdopted ? '重新应用' : '采用'}</span>
												</button>
											</div>
										)
									})
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

					{/* Tab 4: Typography & Color / 字号与色彩调节 */}
					{activeTab === 'typography' && (
						<div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-1 select-none">
							<p className="text-xs text-muted-foreground leading-relaxed">
								微调全屏模式与桌面悬浮歌词的高亮字体色彩（包含正文、翻译与罗马音），以及歌词文本尺寸：
							</p>

							{/* Lyrics Custom Color Card */}
							<div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3 text-xs">
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
									<div className="flex items-center gap-3">
										<div className="flex items-center gap-1.5 shrink-0">
											<Palette className="w-4 h-4 text-primary" />
											<span className="font-semibold text-foreground">歌词颜色</span>
										</div>

										{/* 三个选项在“歌词颜色”右侧：歌词、翻译、罗马音 */}
										<div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/40 border border-white/10 shrink-0">
											<button
												type="button"
												onClick={() => setActiveColorTarget('main')}
												className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
													activeColorTarget === 'main'
														? 'bg-primary text-white font-semibold shadow'
														: 'text-muted-foreground hover:text-foreground'
												}`}
											>
												<span
													className="w-2.5 h-2.5 rounded-full border border-white/20"
													style={{ backgroundColor: lyricColors.main }}
												/>
												<span>歌词</span>
											</button>
											<button
												type="button"
												onClick={() => setActiveColorTarget('trans')}
												className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
													activeColorTarget === 'trans'
														? 'bg-primary text-white font-semibold shadow'
														: 'text-muted-foreground hover:text-foreground'
												}`}
											>
												<span
													className="w-2.5 h-2.5 rounded-full border border-white/20"
													style={{ backgroundColor: lyricColors.trans }}
												/>
												<span>翻译</span>
											</button>
											<button
												type="button"
												onClick={() => setActiveColorTarget('roma')}
												className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1.5 ${
													activeColorTarget === 'roma'
														? 'bg-primary text-white font-semibold shadow'
														: 'text-muted-foreground hover:text-foreground'
												}`}
											>
												<span
													className="w-2.5 h-2.5 rounded-full border border-white/20"
													style={{ backgroundColor: lyricColors.roma }}
												/>
												<span>罗马音</span>
											</button>
										</div>
									</div>

									{/* 选中哪个就调整哪个的颜色 */}
									<div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
										<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/30 border border-white/10">
											<span
												className="w-3 h-3 rounded-full border border-white/30 shadow-sm shrink-0"
												style={{ backgroundColor: lyricColors[activeColorTarget] }}
											/>
											<span className="font-mono text-[10px] text-foreground font-semibold uppercase">
												{lyricColors[activeColorTarget]}
											</span>
										</div>
										<label
											className="relative cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors"
											title="打开调色板选取任意颜色"
										>
											<input
												type="color"
												value={lyricColors[activeColorTarget]}
												onChange={(e) => {
													const col = e.target.value
													setLyricColor(activeColorTarget, col)
													setLyricColors((prev) => ({ ...prev, [activeColorTarget]: col }))
												}}
												className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
											/>
											<span>调色盘</span>
										</label>
									</div>
								</div>

								{/* Color Presets */}
								<div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-0.5">
									{PRESET_LYRICS_COLORS.map((preset) => {
										const currentColor = lyricColors[activeColorTarget]
										const isSelected =
											currentColor.toLowerCase() === preset.value.toLowerCase()
										return (
											<button
												key={preset.value}
												type="button"
												onClick={() => {
													setLyricColor(activeColorTarget, preset.value)
													setLyricColors((prev) => ({
														...prev,
														[activeColorTarget]: preset.value,
													}))
												}}
												className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
													isSelected
														? 'bg-white/10 border-primary ring-1 ring-primary/50'
														: 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
												}`}
												title={`${preset.label} (${preset.value})`}
											>
												<span
													className="w-4 h-4 rounded-full border border-white/20 shadow-sm flex items-center justify-center"
													style={{ backgroundColor: preset.value }}
												>
													{isSelected && (
														<Check className="w-2.5 h-2.5 text-black drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]" />
													)}
												</span>
												<span className="text-[10px] text-muted-foreground font-medium truncate max-w-full">
													{preset.label}
												</span>
											</button>
										)
									})}
								</div>
							</div>

							{/* Sliders Card */}
							<div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-4 text-xs">
								{/* 1. 原文歌词大小 */}
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-foreground">歌词正文字号 (原文)</span>
										<span className="font-mono text-primary font-bold">{fontSizes.main} px</span>
									</div>
									<input
										type="range"
										min="16"
										max="40"
										step="1"
										value={fontSizes.main}
										onChange={(e) => {
											const val = parseInt(e.target.value, 10)
											setFontSizes((prev) => ({ ...prev, main: val }))
											setLyricFontSizes({ main: val })
										}}
										className="w-full accent-primary cursor-pointer"
									/>
									<div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
										<span>16px (紧凑)</span>
										<span>24px (标准)</span>
										<span>40px (特大)</span>
									</div>
								</div>

								{/* 2. 歌词翻译大小 */}
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-foreground">翻译歌词字号</span>
										<span className="font-mono text-sky-400 font-bold">{fontSizes.trans} px</span>
									</div>
									<input
										type="range"
										min="12"
										max="28"
										step="1"
										value={fontSizes.trans}
										onChange={(e) => {
											const val = parseInt(e.target.value, 10)
											setFontSizes((prev) => ({ ...prev, trans: val }))
											setLyricFontSizes({ trans: val })
										}}
										className="w-full accent-sky-400 cursor-pointer"
									/>
									<div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
										<span>12px (精细)</span>
										<span>15px (标准)</span>
										<span>28px (清晰)</span>
									</div>
								</div>

								{/* 3. 罗马音注音大小 */}
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-foreground">罗马音 / 注音字号</span>
										<span className="font-mono text-purple-400 font-bold">{fontSizes.roma} px</span>
									</div>
									<input
										type="range"
										min="10"
										max="24"
										step="1"
										value={fontSizes.roma}
										onChange={(e) => {
											const val = parseInt(e.target.value, 10)
											setFontSizes((prev) => ({ ...prev, roma: val }))
											setLyricFontSizes({ roma: val })
										}}
										className="w-full accent-purple-400 cursor-pointer"
									/>
									<div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
										<span>10px (微型)</span>
										<span>13px (标准)</span>
										<span>24px (大号)</span>
									</div>
								</div>

								{/* Reset button */}
								<div className="pt-1 flex justify-end">
									<button
										onClick={() => {
											const def = { main: 24, trans: 15, roma: 13 }
											setFontSizes(def)
											setLyricFontSizes(def)
											resetLyricColors()
											setLyricColors({
												main: DEFAULT_LYRICS_HIGHLIGHT_COLOR,
												trans: DEFAULT_LYRICS_HIGHLIGHT_COLOR,
												roma: DEFAULT_LYRICS_HIGHLIGHT_COLOR,
											})
										}}
										className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-[11px] font-medium flex items-center gap-1.5 transition-colors"
									>
										<RotateCcw className="w-3 h-3" />
										<span>恢复默认字号与颜色</span>
									</button>
								</div>
							</div>

							{/* Live Preview Card */}
							<div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
								<div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2 border-b border-white/5">
									<span className="font-medium">实时效果预览</span>
									<span className="text-[10px] text-primary">沉浸全屏与桌面歌词同步生效</span>
								</div>
								<div className="pt-2 text-center space-y-1.5">
									{includeRomaji && (
										<p
											className="font-mono tracking-wider truncate"
											style={{
												fontSize: `${fontSizes.roma}px`,
												color: lyricColors.roma,
												opacity: 0.85,
											}}
										>
											kimi to mita yuki no hana ga
										</p>
									)}
									<p
										className="font-bold tracking-wide truncate"
										style={{
											fontSize: `${fontSizes.main}px`,
											color: lyricColors.main,
											filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
										}}
									>
										君と見た雪の华が
									</p>
									{includeTranslation && (
										<p
											className="font-medium truncate"
											style={{
												fontSize: `${fontSizes.trans}px`,
												color: lyricColors.trans,
												opacity: 0.9,
											}}
										>
											与你一同看过的雪之花
										</p>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>,
		document.body,
	)
}