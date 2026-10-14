import React, { useState, useEffect } from 'react'
import {
	X,
	FileText,
	Search,
	Clock,
	Sliders,
	Check,
	RotateCcw,
	Loader2,
	Sparkles,
	Save,
} from 'lucide-react'
import type { Track } from '@bbplayer/shared-core'
import {
	lyricService,
	getStoredLyricOffset,
	setStoredLyricOffset,
	getStoredCustomLyric,
	setStoredCustomLyric,
	type LyricSearchCandidate,
	cleanTrackTitle,
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
	const [offsetMs, setOffsetMs] = useState(0)
	const [loadingCandidateId, setLoadingCandidateId] = useState<string | number | null>(null)
	const [successMsg, setSuccessMsg] = useState<string | null>(null)

	useEffect(() => {
		if (isOpen && track) {
			const cleaned = cleanTrackTitle(track.title)
			setSearchKeyword(`${cleaned} ${track.artist?.name || ''}`.trim())
			setOffsetMs(getStoredLyricOffset(track.uniqueKey))
			setCustomText(getStoredCustomLyric(track.uniqueKey) || '')
			handleSearch(`${cleaned} ${track.artist?.name || ''}`.trim())
		}
	}, [isOpen, track])

	if (!isOpen || !track) return null

	const handleSearch = async (kw: string) => {
		if (!kw.trim()) return
		setIsSearching(true)
		try {
			const results = await lyricService.searchCandidates(kw.trim())
			setCandidates(results)
		} catch (err) {
			console.warn('Search lyrics error:', err)
		} finally {
			setIsSearching(false)
		}
	}

	const handleApplyCandidate = async (candidate: LyricSearchCandidate) => {
		setLoadingCandidateId(candidate.id)
		try {
			const spl = await lyricService.fetchCandidateLyrics(candidate)
			if (spl) {
				setStoredCustomLyric(track.uniqueKey, spl)
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

	const handleSaveCustom = () => {
		if (!customText.trim()) return
		setStoredCustomLyric(track.uniqueKey, customText.trim())
		onLyricsUpdated?.(customText.trim())
		setSuccessMsg('已保存自定义歌词！')
		setTimeout(() => setSuccessMsg(null), 2000)
	}

	const handleAdjustOffset = (deltaMs: number) => {
		const next = Math.round((offsetMs + deltaMs) * 10) / 10
		setOffsetMs(next)
		setStoredLyricOffset(track.uniqueKey, next)
	}

	const handleResetOffset = () => {
		setOffsetMs(0)
		setStoredLyricOffset(track.uniqueKey, 0)
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-lg rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<FileText className="w-4 h-4" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-foreground">
								歌词管理与智能匹配
							</h3>
							<p className="text-[10px] text-muted-foreground truncate max-w-[280px]">
								当前歌曲: {track.title}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Tabs */}
				<div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/5">
					<button
						onClick={() => setActiveTab('search')}
						className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
							activeTab === 'search'
								? 'bg-primary text-white shadow'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						智能搜索匹配
					</button>
					<button
						onClick={() => setActiveTab('custom')}
						className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
							activeTab === 'custom'
								? 'bg-primary text-white shadow'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						粘贴 LRC/SPL
					</button>
					<button
						onClick={() => setActiveTab('offset')}
						className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
							activeTab === 'offset'
								? 'bg-primary text-white shadow'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						时间轴微调 ({offsetMs >= 0 ? `+${offsetMs}` : offsetMs}s)
					</button>
				</div>

				{/* Success notification */}
				{successMsg && (
					<div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
						<Check className="w-3.5 h-3.5" />
						<span>{successMsg}</span>
					</div>
				)}

				{/* Tab 1: Search */}
				{activeTab === 'search' && (
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={searchKeyword}
								onChange={(e) => setSearchKeyword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchKeyword)}
								placeholder="输入歌曲名 / 歌手重新搜索歌词..."
								className="flex-1 h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none"
							/>
							<button
								onClick={() => handleSearch(searchKeyword)}
								disabled={isSearching}
								className="h-9 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
							>
								{isSearching ? (
									<Loader2 className="w-3.5 h-3.5 animate-spin" />
								) : (
									<Search className="w-3.5 h-3.5" />
								)}
								<span>搜索</span>
							</button>
						</div>

						<div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
							{isSearching ? (
								<div className="py-8 text-center space-y-2 text-xs text-muted-foreground">
									<Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
									<p>正在检索网易云与 QQ 音乐歌词库...</p>
								</div>
							) : candidates.length === 0 ? (
								<div className="py-8 text-center text-xs text-muted-foreground">
									未找到匹配歌词，可尝试精简歌曲标题或点击上方“粘贴 LRC/SPL”自定义
								</div>
							) : (
								candidates.map((item) => (
									<div
										key={`${item.source}_${item.id}`}
										className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 flex items-center justify-between gap-3 text-xs"
									>
										<div className="overflow-hidden space-y-0.5">
											<div className="flex items-center gap-2">
												<span className="font-semibold text-foreground truncate max-w-[200px]">
													{item.title}
												</span>
												<span
													className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
														item.source === 'netease'
															? 'bg-red-500/20 text-red-300'
															: 'bg-emerald-500/20 text-emerald-300'
													}`}
												>
													{item.source === 'netease' ? '网易云 (SPL逐字)' : 'QQ音乐'}
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground truncate">
												歌手: {item.artist || '未知'}
											</p>
										</div>

										<button
											onClick={() => handleApplyCandidate(item)}
											disabled={loadingCandidateId === item.id}
											className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors flex items-center gap-1"
										>
											{loadingCandidateId === item.id && (
												<Loader2 className="w-3 h-3 animate-spin" />
											)}
											<span>采用此歌词</span>
										</button>
									</div>
								))
							)}
						</div>
					</div>
				)}

				{/* Tab 2: Custom Text */}
				{activeTab === 'custom' && (
					<div className="space-y-3">
						<p className="text-xs text-muted-foreground leading-relaxed">
							支持直接粘贴标准 LRC 文本或包含逐字进度的 SPL (Salt Player Lyrics) 规范文本：
						</p>
						<textarea
							value={customText}
							onChange={(e) => setCustomText(e.target.value)}
							rows={7}
							placeholder="例如:&#10;[00:00.00]歌曲开始&#10;[00:04.20]<00:04.20>逐<00:04.50>字<00:05.00>进<00:05.50>度"
							className="w-full p-2.5 text-xs font-mono rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed"
						/>
						<div className="flex justify-end">
							<button
								onClick={handleSaveCustom}
								disabled={!customText.trim()}
								className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow flex items-center gap-1.5 transition-colors disabled:opacity-50"
							>
								<Save className="w-3.5 h-3.5" />
								<span>保存并应用</span>
							</button>
						</div>
					</div>
				)}

				{/* Tab 3: Offset Adjust */}
				{activeTab === 'offset' && (
					<div className="space-y-4 py-2">
						<p className="text-xs text-muted-foreground leading-relaxed">
							当视频开头存在前奏剪辑或片头片尾导致歌词与声音不同步时，可微调时间轴偏移量：
						</p>

						<div className="text-center py-4 bg-white/[0.02] rounded-xl border border-white/5">
							<span className="text-2xl font-bold font-mono text-primary">
								{offsetMs >= 0 ? `+${offsetMs.toFixed(2)}` : offsetMs.toFixed(2)} 秒
							</span>
							<p className="text-[11px] text-muted-foreground mt-1">
								{offsetMs > 0 ? '歌词延后显示' : offsetMs < 0 ? '歌词提前显示' : '标准同步'}
							</p>
						</div>

						<div className="grid grid-cols-5 gap-2">
							<button
								onClick={() => handleAdjustOffset(-0.5)}
								className="py-2 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono"
							>
								-0.5s
							</button>
							<button
								onClick={() => handleAdjustOffset(-0.1)}
								className="py-2 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono"
							>
								-0.1s
							</button>
							<button
								onClick={handleResetOffset}
								className="py-2 text-xs rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 font-medium flex items-center justify-center gap-1"
							>
								<RotateCcw className="w-3 h-3" />
								<span>重置</span>
							</button>
							<button
								onClick={() => handleAdjustOffset(0.1)}
								className="py-2 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono"
							>
								+0.1s
							</button>
							<button
								onClick={() => handleAdjustOffset(0.5)}
								className="py-2 text-xs rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-mono"
							>
								+0.5s
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
