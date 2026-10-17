import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, FileAudio, CheckCircle2, AlertCircle, Loader2, FolderOpen } from 'lucide-react'
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

	const handleBrowsePath = async () => {
		if (!track) return
		const defaultName = `${track.title} - ${
			track.artist?.name || '未知歌手'
		}.m4a`.replace(/[\\/:*?"<>|]/g, '_')

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
			}
		} catch (err) {
			console.error('Failed to pick export path:', err)
		}
	}

	useEffect(() => {
		setExportSuccess(false)
		setError(null)
		if (isOpen && track) {
			const defaultName = `${track.title} - ${
				track.artist?.name || '未知歌手'
			}.m4a`.replace(/[\\/:*?"<>|]/g, '_')

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
			} else {
				setCachedPath(null)
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
					// 从 B 站 API 获取音频直链
					const streamRes = await bilibiliApi.getAudioStream({
						bvid,
						cid,
						audioQuality: 30280,
						enableDolby: false,
						enableHiRes: false,
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
							导出为标准 .m4a 音频
						</h3>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{exportSuccess ? (
					<div className="space-y-4 py-3">
						<div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
							<CheckCircle2 className="w-5 h-5 flex-shrink-0" />
							<div className="overflow-hidden">
								<p className="font-semibold">音频导出成功！</p>
								<p className="text-[11px] text-emerald-300/80 truncate" title={outputPath}>
									已保存至: {outputPath}
								</p>
							</div>
						</div>
						<div className="flex justify-end pt-2">
							<button
								onClick={onClose}
								className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white"
							>
								完成
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<div className="space-y-1">
							<p className="text-xs font-semibold text-foreground">
								{track.title}
							</p>
							<p className="text-[11px] text-muted-foreground">
								{track.artist?.name || '未知歌手'}
							</p>
						</div>

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
										在线提取 (导出时自动拉取无损音频流)
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
									placeholder="点击选择或输入保存路径 (.m4a)"
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
							<p className="text-[10px] text-muted-foreground">
								将自动封装为标准 MPEG-4 (.m4a) 容器，并内嵌高清封面、歌曲名称、UP主信息及歌词元数据。
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
								className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:bg-white/5"
							>
								取消
							</button>
							<button
								onClick={handleExport}
								disabled={!outputPath || isExporting}
								className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 shadow-md"
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