import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, FileAudio, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { desktopDir, downloadDir, join } from '@tauri-apps/api/path'
import type { Track, BilibiliTrack } from '@bbplayer/shared-core'

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

	useEffect(() => {
		setExportSuccess(false)
		setError(null)
		if (isOpen && track && track.source === 'bilibili') {
			const bili = track as BilibiliTrack
			const bvid = bili.bilibiliMetadata.bvid
			const cid = bili.bilibiliMetadata.cid || 0

			invoke<string | null>('get_cached_track_path', { bvid, cid })
				.then(async (path) => {
					setCachedPath(path)
					if (path) {
						const defaultName = `${track.title} - ${
							track.artist?.name || '未知歌手'
						}.m4a`.replace(/[\\/:*?"<>|]/g, '_')

						try {
							const baseDir = (await desktopDir().catch(() => downloadDir())) || ''
							const fullPath = baseDir
								? await join(baseDir, defaultName)
								: defaultName
							setOutputPath(fullPath)
						} catch {
							setOutputPath(defaultName)
						}
					}
				})
				.catch((err) => console.error(err))
		}
	}, [isOpen, track])

	if (!isOpen || !track) return null

	const handleExport = async () => {
		if (!cachedPath || !outputPath) return
		setIsExporting(true)
		setError(null)
		try {
			await invoke('export_cached_track_to_m4a', {
				params: {
					cached_file_path: cachedPath,
					output_path: outputPath,
					title: track.title,
					artist: track.artist?.name || '未知歌手',
					album: 'Bili Player',
					cover_url: track.coverUrl,
					lyrics: null,
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

						{cachedPath ? (
							<div className="space-y-3">
								<div className="space-y-1.5">
									<label className="text-[11px] font-semibold text-foreground/80">
										导出目标路径
									</label>
									<input
										type="text"
										value={outputPath}
										onChange={(e) => setOutputPath(e.target.value)}
										className="w-full h-8 px-3 text-xs rounded-xl bg-white/5 border border-white/10 text-foreground outline-none font-mono"
									/>
								</div>
								<p className="text-[10px] text-muted-foreground">
									将自动内嵌高清封面二进制、歌名、UP主元数据与标准 MPEG-4 容器。
								</p>
							</div>
						) : (
							<div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
								该歌曲尚未完成本地流媒体缓存，请先播放试听该歌曲，流媒体代理将自动完成无损落盘缓存。
							</div>
						)}

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
								disabled={!cachedPath || isExporting}
								className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 shadow-md"
							>
								{isExporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
								<span>立即导出</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</div>,
		document.body,
	)
}