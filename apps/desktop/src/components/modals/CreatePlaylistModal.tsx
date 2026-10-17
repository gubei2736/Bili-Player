import React, { useState } from 'react'
import { X, FolderPlus, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { useLocalPlaylistStore } from '@bbplayer/shared-core'

export interface CreatePlaylistModalProps {
	isOpen: boolean
	onClose: () => void
	onSuccess?: (title: string) => void
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
	isOpen,
	onClose,
	onSuccess,
}) => {
	const [title, setTitle] = useState('')
	const [intro, setIntro] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [createdSuccess, setCreatedSuccess] = useState(false)

	if (!isOpen) return null

	const handleCreate = async () => {
		if (!title.trim()) {
			setError('请输入歌单名称')
			return
		}
		setError(null)
		setLoading(true)

		try {
			// 本地独立歌单创建
			useLocalPlaylistStore.getState().createPlaylist(title.trim(), intro.trim())
			setCreatedSuccess(true)
			setTimeout(() => {
				setCreatedSuccess(false)
				setTitle('')
				setIntro('')
				onSuccess?.(title.trim())
				onClose()
			}, 1000)
		} catch (err) {
			setError(err instanceof Error ? err.message : '创建歌单遇到异常')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-md rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<FolderPlus className="w-4 h-4" />
						</div>
						<h3 className="text-sm font-bold text-foreground">
							新建音乐歌单
						</h3>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{createdSuccess ? (
					<div className="py-8 text-center space-y-3">
						<CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
						<p className="text-sm font-bold text-foreground">
							歌单「{title}」创建成功！
						</p>
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
								placeholder="例如: 我的专属睡眠轻音乐"
								maxLength={40}
								className="w-full h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none"
							/>
						</div>

						{/* Intro input */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-foreground/80">
								歌单简介（选填）
							</label>
							<textarea
								value={intro}
								onChange={(e) => setIntro(e.target.value)}
								placeholder="输入简短简介描述..."
								rows={2}
								maxLength={150}
								className="w-full p-2.5 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none resize-none"
							/>
						</div>

						{error && (
							<div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
								{error}
							</div>
						)}

						{/* Action Buttons */}
						<div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
							<button
								onClick={onClose}
								className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
							>
								取消
							</button>
							<button
								onClick={handleCreate}
								disabled={loading || !title.trim()}
								className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
							>
								{loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
								<span>立即创建</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
