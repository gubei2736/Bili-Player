import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
	X,
	Download,
	FolderOpen,
	CheckCircle2,
	AlertCircle,
	Loader2,
	Sparkles,
	Square,
	CheckSquare,
	FolderCheck,
	Music,
	Play,
	Pause,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { desktopDir, downloadDir, join } from '@tauri-apps/api/path'
import { bilibiliApi, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { lyricService } from '../../services/lyricService'

export interface BatchExportModalProps {
	isOpen: boolean
	onClose: () => void
	title: string
	tracks: Track[]
}

type TrackExportStatus = 'pending' | 'resolving' | 'downloading' | 'success' | 'error'

interface TrackProgressItem {
	track: Track
	status: TrackExportStatus
	spec?: string
	error?: string
	outputPath?: string
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
	isOpen,
	onClose,
	title,
	tracks,
}) => {
	// Base directory & subfolder settings
	const [baseDir, setBaseDir] = useState<string>('')
	const [createSubfolder, setCreateSubfolder] = useState<boolean>(true)
	const [selectedTrackKeys, setSelectedTrackKeys] = useState<Set<string>>(new Set())

	// Download state
	const [isExporting, setIsExporting] = useState<boolean>(false)
	const [isFinished, setIsFinished] = useState<boolean>(false)
	const [progressList, setProgressList] = useState<TrackProgressItem[]>([])
	const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1)
	const [successCount, setSuccessCount] = useState<number>(0)
	const [failCount, setFailCount] = useState<number>(0)

	const isCancelledRef = useRef<boolean>(false)
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	// Filter out any purely local tracks
	const onlineTracks = tracks.filter((t) => t.source !== 'local')

	// Initialize paths & track selections
	useEffect(() => {
		if (isOpen) {
			setIsExporting(false)
			setIsFinished(false)
			setCurrentProcessingIndex(-1)
			setSuccessCount(0)
			setFailCount(0)
			isCancelledRef.current = false

			const allKeys = new Set(onlineTracks.map((t) => t.uniqueKey))
			setSelectedTrackKeys(allKeys)

			const initialItems: TrackProgressItem[] = onlineTracks.map((t) => ({
				track: t,
				status: 'pending',
			}))
			setProgressList(initialItems)

			const savedExportDir = localStorage.getItem('bili_player_export_dir')
			if (savedExportDir && savedExportDir.trim()) {
				setBaseDir(savedExportDir.trim())
			} else {
				desktopDir()
					.catch(() => downloadDir())
					.then((dir) => {
						if (dir) setBaseDir(dir)
					})
					.catch(() => {})
			}
		}
	}, [isOpen, tracks])

	if (!isOpen) return null

	const handleBrowseDir = async () => {
		try {
			const selected = await invoke<string | null>('pick_export_dir', {
				defaultDir: baseDir || undefined,
			})
			if (selected) {
				setBaseDir(selected)
				localStorage.setItem('bili_player_export_dir', selected)
				window.dispatchEvent(new CustomEvent('bbplayer:export-dir-change', { detail: selected }))
			}
		} catch (err) {
			console.error('Failed to pick directory:', err)
		}
	}

	const toggleSelectTrack = (key: string) => {
		if (isExporting) return
		setSelectedTrackKeys((prev) => {
			const next = new Set(prev)
			if (next.has(key)) {
				next.delete(key)
			} else {
				next.add(key)
			}
			return next
		})
	}

	const toggleSelectAll = () => {
		if (isExporting) return
		if (selectedTrackKeys.size === onlineTracks.length) {
			setSelectedTrackKeys(new Set())
		} else {
			setSelectedTrackKeys(new Set(onlineTracks.map((t) => t.uniqueKey)))
		}
	}

	// Compute final target directory
	const sanitizedFolderName = (title || '批量导出')
		.replace(/[\\/:*?"<>|]/g, '_')
		.trim()

	const getFinalTargetFolder = async (): Promise<string> => {
		if (!baseDir) return ''
		if (!createSubfolder) return baseDir
		try {
			return await join(baseDir, sanitizedFolderName)
		} catch {
			return `${baseDir}\\${sanitizedFolderName}`
		}
	}

	const handleStartExport = async () => {
		if (!baseDir || selectedTrackKeys.size === 0 || isExporting) return

		setIsExporting(true)
		setIsFinished(false)
		isCancelledRef.current = false
		setSuccessCount(0)
		setFailCount(0)

		const targetFolder = await getFinalTargetFolder()
		const selectedItems = progressList.filter((item) =>
			selectedTrackKeys.has(item.track.uniqueKey),
		)

		let sCount = 0
		let fCount = 0

		for (let i = 0; i < selectedItems.length; i++) {
			if (isCancelledRef.current) break

			const item = selectedItems[i]!
			const originalIndex = progressList.findIndex(
				(p) => p.track.uniqueKey === item.track.uniqueKey,
			)
			setCurrentProcessingIndex(originalIndex)

			// Update status to resolving
			setProgressList((prev) =>
				prev.map((p, idx) =>
					idx === originalIndex ? { ...p, status: 'resolving' } : p,
				),
			)

			try {
				const track = item.track
				let streamUrl: string | null = null
				let finalCachedPath: string | null = null
				let specText = '标准 AAC (132K)'
				let fileExt = 'm4a'

				if (track.source === 'bilibili') {
					const bili = track as BilibiliTrack
					const bvid = bili.bilibiliMetadata.bvid
					let cid = bili.bilibiliMetadata.cid

					// 1. 如果无 CID，获取分 P
					if (!cid) {
						const pageListRes = await bilibiliApi.getPageList({ bvid })
						if (pageListRes.isOk() && pageListRes.value.length > 0) {
							const explicitPageIndex = bili.bilibiliMetadata.pageIndex
							const matched = explicitPageIndex
								? pageListRes.value.find((p) => p.page === explicitPageIndex)
								: pageListRes.value[0]
							cid = matched?.cid || pageListRes.value[0]!.cid
						}
					}

					if (!cid) {
						throw new Error('未获取到音频流分P标识 (CID)')
					}

					// 2. 检查本地是否有对应缓存
					try {
						finalCachedPath = await invoke<string | null>('get_cached_track_path', { bvid, cid })
					} catch {}

					// 3. 拉取当前账号最高规格音频流
					if (!finalCachedPath) {
						const streamRes = await bilibiliApi.getAudioStream({
							bvid,
							cid,
							audioQuality: 30280,
							enableDolby: true,
							enableHiRes: true,
						})

						if (streamRes.isErr()) {
							throw new Error(`获取音频流失败: ${streamRes.error.message}`)
						}

						const streamData = streamRes.value
						streamUrl = streamData.url
						const q = streamData.quality
						const isFlac = q === 30251 || streamData.codecs?.toLowerCase().includes('flac')
						const isDolby = q === 30250 || streamData.codecs?.toLowerCase().includes('ec-3')

						if (isFlac) {
							specText = 'Hi-Res 无损 (FLAC)'
							fileExt = 'flac'
						} else if (isDolby) {
							specText = '杜比全景声'
							fileExt = 'm4a'
						} else if (q === 30280) {
							specText = '192K AAC'
							fileExt = 'm4a'
						}
					} else {
						specText = '命中本地缓存'
					}
				}

				// 构造文件名与目标全路径
				const sanitizedFileName = `${track.title} - ${
					track.artist?.name || '未知歌手'
				}.${fileExt}`.replace(/[\\/:*?"<>|]/g, '_')

				let fullOutputPath: string
				try {
					fullOutputPath = await join(targetFolder, sanitizedFileName)
				} catch {
					fullOutputPath = `${targetFolder}\\${sanitizedFileName}`
				}

				// Update status to downloading
				setProgressList((prev) =>
					prev.map((p, idx) =>
						idx === originalIndex
							? { ...p, status: 'downloading', spec: specText, outputPath: fullOutputPath }
							: p,
					),
				)

				// 获取歌词
				let lyricsText: string | null = null
				try {
					const lrc = await lyricService.fetchLyricForTrack(track)
					if (lrc?.splContent) {
						lyricsText = lrc.splContent
					}
				} catch {}

				// 调用后端导出
				await invoke('export_cached_track_to_m4a', {
					params: {
						cached_file_path: finalCachedPath,
						stream_url: streamUrl,
						cache_save_path: null,
						output_path: fullOutputPath,
						title: track.title,
						artist: track.artist?.name || '未知歌手',
						album: title,
						cover_url: track.coverUrl,
						lyrics: lyricsText,
					},
				})

				sCount++
				setSuccessCount(sCount)
				setProgressList((prev) =>
					prev.map((p, idx) =>
						idx === originalIndex ? { ...p, status: 'success' } : p,
					),
				)
			} catch (err: any) {
				fCount++
				setFailCount(fCount)
				const errMsg = err?.message || String(err)
				setProgressList((prev) =>
					prev.map((p, idx) =>
						idx === originalIndex
							? { ...p, status: 'error', error: errMsg }
							: p,
					),
				)
			}
		}

		setIsExporting(false)
		setIsFinished(true)
		setCurrentProcessingIndex(-1)
	}

	const handleCancel = () => {
		isCancelledRef.current = true
		setIsExporting(false)
	}

	const handleOpenTargetFolder = async () => {
		const targetFolder = await getFinalTargetFolder()
		if (targetFolder) {
			try {
				await invoke('open_folder_in_explorer', { folderPath: targetFolder })
			} catch (e) {
				console.error('Failed to open folder:', e)
			}
		}
	}

	const totalSelected = selectedTrackKeys.size
	const processedCount = successCount + failCount
	const progressPercent =
		totalSelected > 0 ? Math.round((processedCount / totalSelected) * 100) : 0

	return createPortal(
		<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
			<div className="w-full max-w-xl rounded-2xl bg-[#0f1422] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
				{/* Modal Header */}
				<div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="w-7 h-7 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
							<Download className="w-4 h-4" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
								<span>批量下载音频</span>
								<span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 flex items-center gap-1">
									<Sparkles className="w-3 h-3 text-amber-400" />
									<span>支持大会员最高规格 (Hi-Res / 杜比 / 192K)</span>
								</span>
							</h3>
							<p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-sm">
								来源：{title}（共 {onlineTracks.length} 首在线曲目）
							</p>
						</div>
					</div>
					{!isExporting && (
						<button
							onClick={onClose}
							className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
						>
							<X className="w-4 h-4" />
						</button>
					)}
				</div>

				{/* Modal Body */}
				<div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
					{/* Directory Selection Section */}
					<div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
						<div className="flex items-center justify-between">
							<label className="text-xs font-semibold text-foreground/90">
								导出目标目录
							</label>
							<label className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none">
								<input
									type="checkbox"
									checked={createSubfolder}
									onChange={(e) => setCreateSubfolder(e.target.checked)}
									disabled={isExporting}
									className="accent-primary rounded"
								/>
								<span>创建歌单同名子文件夹</span>
							</label>
						</div>

						<div className="relative flex items-center">
							<input
								type="text"
								value={
									createSubfolder && baseDir
										? `${baseDir}\\${sanitizedFolderName}`
										: baseDir
								}
								readOnly
								className="w-full h-8 pl-3 pr-20 text-xs rounded-xl bg-white/5 border border-white/10 text-foreground outline-none font-mono transition-colors"
								placeholder="请选择保存目录"
							/>
							<button
								type="button"
								onClick={handleBrowseDir}
								disabled={isExporting}
								className="absolute right-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/10 hover:bg-white/20 text-foreground flex items-center gap-1 transition-colors disabled:opacity-50"
							>
								<FolderOpen className="w-3.5 h-3.5 text-primary" />
								<span>更改目录</span>
							</button>
						</div>
					</div>

					{/* Download Progress Bar (visible during or after export) */}
					{(isExporting || isFinished) && (
						<div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span className="font-semibold text-foreground flex items-center gap-1.5">
									{isExporting ? (
										<>
											<Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
											<span>正在批量下载音频中...</span>
										</>
									) : (
										<>
											<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
											<span className="text-emerald-400">下载任务已结束</span>
										</>
									)}
								</span>
								<span className="font-mono text-muted-foreground">
									{processedCount} / {totalSelected} ({progressPercent}%)
								</span>
							</div>

							<div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
								<div
									className={`h-full transition-all duration-300 rounded-full ${
										isFinished
											? 'bg-emerald-500'
											: 'bg-gradient-to-r from-primary to-[#00AEEC]'
									}`}
									style={{ width: `${progressPercent}%` }}
								/>
							</div>

							<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
								<span className="text-emerald-400">成功：{successCount} 首</span>
								{failCount > 0 && (
									<span className="text-rose-400">失败：{failCount} 首</span>
								)}
								<span>
									{isExporting && currentProcessingIndex >= 0 && (
										<span className="truncate max-w-[200px] inline-block text-right">
											当前：{progressList[currentProcessingIndex]?.track.title}
										</span>
									)}
								</span>
							</div>
						</div>
					)}

					{/* Track Selection & Status List */}
					<div className="space-y-2">
						<div className="flex items-center justify-between px-1 text-xs">
							<button
								type="button"
								onClick={toggleSelectAll}
								disabled={isExporting}
								className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium transition-colors disabled:opacity-50"
							>
								{selectedTrackKeys.size === onlineTracks.length ? (
									<CheckSquare className="w-4 h-4 text-primary" />
								) : (
									<Square className="w-4 h-4" />
								)}
								<span>
									{selectedTrackKeys.size === onlineTracks.length ? '取消全选' : '全选全部'}
								</span>
							</button>

							<span className="text-muted-foreground text-[11px]">
								已选择 {selectedTrackKeys.size} / {onlineTracks.length} 首歌曲
							</span>
						</div>

						{/* Scrollable track list */}
						<div
							ref={scrollContainerRef}
							className="max-h-60 overflow-y-auto rounded-xl border border-white/5 bg-black/20 divide-y divide-white/5 scrollbar-thin"
						>
							{progressList.map((item, index) => {
								const isSelected = selectedTrackKeys.has(item.track.uniqueKey)
								const isCurrent = index === currentProcessingIndex
								return (
									<div
										key={item.track.uniqueKey}
										onClick={() => toggleSelectTrack(item.track.uniqueKey)}
										className={`flex items-center justify-between p-2.5 text-xs transition-colors cursor-pointer ${
											isCurrent
												? 'bg-primary/15'
												: isSelected
													? 'hover:bg-white/5'
													: 'opacity-50 hover:bg-white/[0.02]'
										}`}
									>
										<div className="flex items-center gap-2.5 overflow-hidden flex-1 pr-3">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => {}}
												disabled={isExporting}
												className="accent-primary rounded flex-shrink-0"
											/>
											<span className="text-muted-foreground font-mono text-[10px] w-5 text-right flex-shrink-0">
												{index + 1}
											</span>
											<div className="overflow-hidden">
												<p className="font-medium text-foreground truncate text-xs">
													{item.track.title}
												</p>
												<p className="text-[10px] text-muted-foreground truncate">
													{item.track.artist?.name || '未知歌手'}
												</p>
											</div>
										</div>

										{/* Status Indicator */}
										<div className="flex-shrink-0 text-right">
											{item.status === 'pending' && (
												<span className="text-[10px] text-muted-foreground/60">
													等待下载
												</span>
											)}
											{item.status === 'resolving' && (
												<span className="text-[10px] text-sky-400 flex items-center gap-1">
													<Loader2 className="w-3 h-3 animate-spin" />
													<span>解析音质</span>
												</span>
											)}
											{item.status === 'downloading' && (
												<span className="text-[10px] text-amber-300 flex items-center gap-1 font-medium">
													<Loader2 className="w-3 h-3 animate-spin" />
													<span>{item.spec || '下载中...'}</span>
												</span>
											)}
											{item.status === 'success' && (
												<span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
													<CheckCircle2 className="w-3.5 h-3.5" />
													<span>{item.spec || '成功'}</span>
												</span>
											)}
											{item.status === 'error' && (
												<span
													className="text-[10px] text-rose-400 flex items-center gap-1"
													title={item.error}
												>
													<AlertCircle className="w-3.5 h-3.5" />
													<span>失败</span>
												</span>
											)}
										</div>
									</div>
								)
							})}
						</div>
					</div>
				</div>

				{/* Modal Footer */}
				<div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/20">
					<div>
						{isFinished && (
							<button
								onClick={handleOpenTargetFolder}
								className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-foreground transition-colors"
							>
								<FolderCheck className="w-4 h-4 text-emerald-400" />
								<span>打开下载目录</span>
							</button>
						)}
					</div>

					<div className="flex items-center gap-2">
						{isExporting ? (
							<button
								onClick={handleCancel}
								className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-colors"
							>
								停止下载
							</button>
						) : isFinished ? (
							<button
								onClick={onClose}
								className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-md transition-colors"
							>
								完成
							</button>
						) : (
							<>
								<button
									onClick={onClose}
									className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:bg-white/5 transition-colors"
								>
									取消
								</button>
								<button
									onClick={handleStartExport}
									disabled={!baseDir || selectedTrackKeys.size === 0}
									className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white disabled:opacity-50 shadow-md transition-colors"
								>
									<Download className="w-3.5 h-3.5" />
									<span>开始批量下载 ({selectedTrackKeys.size})</span>
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		</div>,
		document.body,
	)
}
