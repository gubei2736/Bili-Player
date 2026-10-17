import React, { useState, useEffect } from 'react'
import { X, Pencil, CheckCircle2, Image as ImageIcon } from 'lucide-react'
import { useLocalPlaylistStore, type LocalPlaylist } from '@bbplayer/shared-core'

export interface EditPlaylistModalProps {
	isOpen: boolean
	playlist: LocalPlaylist | null
	onClose: () => void
	onSuccess?: () => void
}

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
	isOpen,
	playlist,
	onClose,
	onSuccess,
}) => {
	const [title, setTitle] = useState('')
	const [intro, setIntro] = useState('')
	const [coverUrl, setCoverUrl] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [savedSuccess, setSavedSuccess] = useState(false)

	useEffect(() => {
		if (playlist) {
			setTitle(playlist.title || '')
			setIntro(playlist.intro || '')
			setCoverUrl(playlist.coverUrl || '')
			setError(null)
			setSavedSuccess(false)
		}
	}, [playlist, isOpen])

	if (!isOpen || !playlist) return null

	const handleSave = () => {
		if (!title.trim()) {
			setError('歌单名称不能为空')
			return
		}
		setError(null)

		try {
			useLocalPlaylistStore.getState().updatePlaylist(playlist.id, {
				title: title.trim(),
				intro: intro.trim(),
				coverUrl: coverUrl.trim() || null,
			})

			setSavedSuccess(true)
			setTimeout(() => {
				setSavedSuccess(false)
				onSuccess?.()
				onClose()
			}, 600)
		} catch (err) {
			setError(err instanceof Error ? err.message : '更新歌单信息失败')
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-md rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<Pencil className="w-4 h-4" />
						</div>
						<h3 className="text-sm font-bold text-foreground">编辑歌单信息</h3>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{savedSuccess ? (
					<div className="py-8 text-center space-y-3">
						<CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
						<p className="text-sm font-bold text-foreground">歌单信息已更新！</p>
					</div>
				) : (
					<div className="space-y-4">
						{/* Title input */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-foreground/80">
								歌单名称 <span className="text-primary">*</span>
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="歌单名称..."
								maxLength={40}
								className="w-full h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none"
							/>
						</div>

						{/* Cover URL input & Preview */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-foreground/80">
								封面图片链接（选填）
							</label>
							<div className="flex gap-3 items-center">
								<div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center text-muted-foreground">
									{coverUrl.trim() ? (
										<img
											src={coverUrl.trim()}
											alt=""
											referrerPolicy="no-referrer"
											className="w-full h-full object-cover"
											onError={(e) => {
												;(e.currentTarget as HTMLElement).style.display = 'none'
											}}
										/>
									) : (
										<ImageIcon className="w-5 h-5 opacity-40" />
									)}
								</div>
								<input
									type="text"
									value={coverUrl}
									onChange={(e) => setCoverUrl(e.target.value)}
									placeholder="https://... 或留空自动使用歌曲封面"
									className="flex-1 h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none"
								/>
							</div>
						</div>

						{/* Intro input */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-foreground/80">
								歌单简介（选填）
							</label>
							<textarea
								value={intro}
								onChange={(e) => setIntro(e.target.value)}
								placeholder="介绍一下这个歌单吧..."
								rows={3}
								maxLength={200}
								className="w-full p-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none resize-none"
							/>
						</div>

						{error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

						{/* Actions */}
						<div className="flex items-center justify-end gap-2 pt-2">
							<button
								onClick={onClose}
								className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl transition-colors"
							>
								取消
							</button>
							<button
								onClick={handleSave}
								className="px-5 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
							>
								保存修改
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
