import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, FileAudio, CheckCircle2, AlertCircle, Loader2, FolderOpen, Sparkles, ExternalLink } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { desktopDir, downloadDir, join } from '@tauri-apps/api/path'
import { bilibiliApi, type Track, type BilibiliTrack } from '@bbplayer/shared-core'
import { lyricService } from '../../services/lyricService'

export interface ExportTrackModalProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
}

export const ExportTrackModal: React.FC<ExportTrackModalProps> = ({
	isOpen,
	onClose,
	track,
}) => {
	const [cachedPath, setCachedPath] = useState<string | null>(null)
	const [isExporting, setIsExporting] = useState(false)
	const [exportSuccess, setExportSuccess] = useState(false)
	const [outputPath, setOutputPath] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [resolvedSpec, setResolvedSpec] = useState<{
		label: string
		ext: 'flac' | 'm4a'
		color: string
	} | null>(null)

	const handleBrowsePath = async () => {
		if (!track) return
		const ext = resolvedSpec?.ext || 'm4a'
		const defaultName = `${track.title} - ${
			track.artist?.name || '未知歌手'
		}.${ext}`.replace(/[\\/:*?"<>|]/g, '_')

		let defaultDirStr: string | undefined = undefined
		if (outputPath) {
			const lastSlash = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'))
			if (lastSlash > 0) {
				defaultDirStr = outputPath.substring(0, lastSlash)
			}
		}

		try {
			const selected = await invoke<string | null>('pick_export_path', {
				defaultFilename: defaultName,
				defaultDir: defaultDirStr,
			})
			if (selected) {
				setOutputPath(selected)
				const lastSlash = Math.max(selected.lastIndexOf('/'), selected.lastIndexOf('\\'))
				if (lastSlash > 0) {
					const newDir = selected.substring(0, lastSlash)
					localStorage.setItem('bili_player_export_dir', newDir)
					window.dispatchEvent(new CustomEvent('bbplayer:export-dir-change', { detail: newDir }))
				}
			}
		} catch (err) {
			console.error('Failed to pick export path:', err)
		}
	}

	const handleOpenFolder = async () => {
		if (!outputPath) return
		try {
			await invoke('open_folder_in_explorer', { folderPath: outputPath })
		} catch (e) {
			console.error('Failed to open folder:', e)
		}
	}

	useEffect(() => {
		setExportSuccess(false)
		setError(null)
		setResolvedSpec(null)
		if (isOpen && track) {
			const savedExportDir = localStorage.getItem('bili_player_export_dir')

			if (track.source === 'bilibili') {
				const bili = track as BilibiliTrack
				const bvid = bili.bilibiliMetadata.bvid
				const cid = bili.bilibiliMetadata.cid || 0

				if (cid) {
					invoke<string | null>('get_cached_track_path', { bvid, cid })
						.then((path) => setCachedPath(path))
						.catch(() => setCachedPath(null))
				} else {
					setCachedPath(null)
				}

				// 预解析最高音质规格
				bilibiliApi
					.getAudioStream({
						bvid,
						cid: cid || 0,
						audioQuality: 30280,
						enableDolby: true,
						enableHiRes: true,
					})
					.then((res) => {
						if (res.isOk()) {
							const q = res.value.quality
							const isFlac = q === 30251 || res.value.codecs?.toLowerCase().includes('flac')
							const isDolby = q === 30250 || res.value.codecs?.toLowerCase().includes('ec-3')
							let specInfo = {
								label: '标准 AAC 音质',
								ext: 'm4a' as const,
								color: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
							}
							if (isFlac) {
								specInfo = {
									label: '大会员 Hi-Res 无损音质 (FLAC)',
									ext: 'flac' as const,
									color: 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold',
								}
							} else if (isDolby) {
								specInfo = {
									label: '大会员 杜比全景声 (Dolby Atmos)',
									ext: 'm4a' as const,
									color: 'bg-purple-500/20 text-purple-300 border-purple-500/30 font-semibold',
								}
							} else if (q === 30280) {
								specInfo = {
									label: '高规格 192K (AAC)',
									ext: 'm4a' as const,
									color: 'bg-[#00AEEC]/15 text-[#00AEEC] border-[#00AEEC]/30',
								}
							}
							setResolvedSpec(specInfo)

							// 调整后缀名
							const currentName = `${track.title} - ${
								track.artist?.name || '未知歌手'
							}.${specInfo.ext}`.replace(/[\\/:*?"<>|]/g, '_')

							if (savedExportDir && savedExportDir.trim()) {
								join(savedExportDir.trim(), currentName)
									.then((full) => setOutputPath(full))
									.catch(() => setOutputPath(`${savedExportDir.trim()}\\${currentName}`))
							} else {
								desktopDir()
									.catch(() => downloadDir())
									.then(async (baseDir) => {
										setOutputPath(baseDir ? await join(baseDir, currentName) : currentName)
									})
									.catch(() => setOutputPath(currentName))
							}
						}
					})
					.catch(() => {})
			} else {
				setCachedPath(null)
			}

			// 兜底默认路径
			const defaultName = `${track.title} - ${
				track.artist?.name || '未知歌手'
			}.m4a`.replace(/[\\/:*?"<>|]/g, '_')

			if (savedExportDir && savedExportDir.trim()) {
				join(savedExportDir.trim(), defaultName)
					.then((fullPath) => setOutputPath(fullPath))
					.catch(() => setOutputPath(`${savedExportDir.trim()}\\${defaultName}`))
			} else {
				desktopDir()
					.catch(() => downloadDir())
					.then(async (baseDir) => {
						const fullPath = baseDir
							? await join(baseDir, defaultName)
							: defaultName
						setOutputPath(fullPath)
					})
					.catch(() => {
						setOutputPath(defaultName)
					})
			}
		}
	}, [isOpen, track])

	if (!isOpen || !track) return null

	const handleExport = async () => {
		if (!outputPath || !track) return
		setIsExporting(true)
		setError(null)

		try {
			let streamUrl: string | null = null
			let finalCachedPath = cachedPath

			if (!finalCachedPath && track.source === 'bilibili') {
				const bili = track as BilibiliTrack
				const bvid = bili.bilibiliMetadata.bvid
				let cid = bili.bilibiliMetadata.cid

				// 如果未拿到 CID，动态拉取分 P 列表获取 CID
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
					throw new Error('未能获取该歌曲的音频流分 P 标识 (CID)')
				}

				// 检查本地是否有对应缓存
				try {
					finalCachedPath = await invoke<string | null>('get_cached_track_path', { bvid, cid })
				} catch {}

				if (!finalCachedPath) {
					// 优先以最高规格（Hi-Res / 杜比 / 192K AAC）拉取音频流
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
					streamUrl = streamRes.value.url
				}
			}

			// 获取歌词元数据用于内嵌
			let lyricsText: string | null = null
			try {
				const lrc = await lyricService.fetchLyricForTrack(track)
				if (lrc?.splContent) {
					lyricsText = lrc.splContent
				}
			} catch {}

			await invoke('export_cached_track_to_m4a', {
				params: {
					cached_file_path: finalCachedPath,
					stream_url: streamUrl,
					cache_save_path: null,
					output_path: outputPath,
					title: track.title,
					artist: track.artist?.name || '未知歌手',
					album: 'Bili Player',
					cover_url: track.coverUrl,
					lyrics: lyricsText,
				},
			})

			setIsExporting(false)
			setExportSuccess(true)
		} catch (err: any) {
			setIsExporting(false)
			setError(err?.message || String(err))
		}
	}

	return createPortal(
		<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-md rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden p-6 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<FileAudio className="w-3.5 h-3.5" />
						</div>
						<h3 className="text-sm font-bold text-foreground">
							导出高规格音频
						</h3>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{exportSuccess ? (
					<div className="space-y-4 py-3">
						<div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
							<CheckCircle2 className="w-5 h-5 flex-shrink-0" />
							<div className="overflow-hidden space-y-0.5">
								<p className="font-semibold">音频导出成功！</p>
								<p className="text-[11px] text-emerald-300/80 truncate" title={outputPath}>
									已保存至: {outputPath}
								</p>
							</div>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={handleOpenFolder}
								className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-foreground flex items-center gap-1.5 transition-colors"
							>
								<FolderOpen className="w-3.5 h-3.5 text-primary" />
								<span>打开所在文件夹</span>
							</button>
							<button
								onClick={onClose}
								className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
							>
								完成
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<div className="space-y-1">
							<p className="text-xs font-semibold text-foreground truncate">
								{track.title}
							</p>
							<p className="text-[11px] text-muted-foreground">
								{track.artist?.name || '未知歌手'}
							</p>
						</div>

						{/* Audio Quality Spec Badge */}
						{resolvedSpec && (
							<div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
								<span className="text-[11px] text-muted-foreground flex items-center gap-1">
									<Sparkles className="w-3.5 h-3.5 text-amber-400" />
									<span>当前导出音频规格</span>
								</span>
								<span className={`text-[10px] px-2 py-0.5 rounded-md border ${resolvedSpec.color}`}>
									{resolvedSpec.label}
								</span>
							</div>
						)}

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<label className="text-[11px] font-semibold text-foreground/80">
									导出目标路径
								</label>
								{cachedPath ? (
									<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
										本地已就绪 (秒速导出)
									</span>
								) : (
									<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/20">
										在线提取 (自动按账号最高规格拉取)
									</span>
								)}
							</div>
							<div className="relative flex items-center">
								<input
									type="text"
									value={outputPath}
									onClick={handleBrowsePath}
									onChange={(e) => setOutputPath(e.target.value)}
									className="w-full h-8 pl-3 pr-20 text-xs rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-foreground outline-none font-mono cursor-pointer transition-colors"
									placeholder="点击选择或输入保存路径"
								/>
								<button
									type="button"
									onClick={handleBrowsePath}
									className="absolute right-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/10 hover:bg-white/20 text-foreground flex items-center gap-1 transition-colors"
									title="选择导出目录与文件名"
								>
									<FolderOpen className="w-3.5 h-3.5 text-primary" />
									<span>浏览</span>
								</button>
							</div>
							<p className="text-[10px] text-muted-foreground leading-relaxed">
								将自动按当前账号权限最高规格拉取并保存（Hi-Res 无损 FLAC / 杜比全景声 / 192K AAC），内嵌高清封面、歌词与元数据标签。
							</p>
						</div>

						{error && (
							<div className="flex items-center gap-2 p-2 rounded-xl bg-red-500/10 text-xs text-red-400">
								<AlertCircle className="w-4 h-4 flex-shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={onClose}
								className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:bg-white/5 transition-colors"
							>
								取消
							</button>
							<button
								onClick={handleExport}
								disabled={!outputPath || isExporting}
								className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 shadow-md transition-colors"
							>
								{isExporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
								<span>{isExporting ? '正在导出...' : '立即导出'}</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</div>,
		document.body,
	)
}
