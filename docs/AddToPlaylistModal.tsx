import React, { useState } from 'react'
import { X, FolderPlus, Plus, Music, Check, Sparkles } from 'lucide-react'
import { useLocalPlaylistStore, type Track } from '@bbplayer/shared-core'

export interface AddToPlaylistModalProps {
	isOpen: boolean
	onClose: () => void
	track: Track | null
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
	isOpen,
	onClose,
	track,
}) => {
	const { playlists, addTrackToPlaylist, createPlaylist } = useLocalPlaylistStore()
	const [newTitle, setNewTitle] = useState('')
	const [isCreating, setIsCreating] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	if (!isOpen || !track) return null

	const handleAdd = (playlistId: string, playlistTitle: string) => {
		const success = addTrackToPlaylist(playlistId, track)
		if (success) {
			setMessage(`已成功添加至【${playlistTitle}】`)
			setTimeout(() => {
				setMessage(null)
				onClose()
			}, 1200)
		} else {
			setMessage(`【${playlistTitle}】中已存在该曲目`)
			setTimeout(() => setMessage(null), 1500)
		}
	}

	const handleCreateAndAdd = () => {
		if (!newTitle.trim()) return
		const newPl = createPlaylist(newTitle.trim(), '', track.coverUrl || undefined, [track])
		setMessage(`已创建【${newPl.title}】并成功添加歌曲`)
		setTimeout(() => {
			setMessage(null)
			setNewTitle('')
			setIsCreating(false)
			onClose()
		}, 1200)
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-sm rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col p-5 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<FolderPlus className="w-4 h-4" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-foreground">添加到歌单</h3>
							<p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={track.title}>
								{track.title}
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

				{/* Notice */}
				{message && (
					<div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
						<Check className="w-3.5 h-3.5 flex-shrink-0" />
						<span>{message}</span>
					</div>
				)}

				{/* Playlists List */}
				<div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
					{playlists.length === 0 ? (
						<div className="py-6 text-center text-xs text-muted-foreground">
							我的音乐库中暂无歌单，可点击下方新建歌单
						</div>
					) : (
						playlists.map((pl) => (
							<div
								key={pl.id}
								onClick={() => handleAdd(pl.id, pl.title)}
								className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
							>
								<div className="flex items-center gap-2.5 overflow-hidden">
									<div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary overflow-hidden flex-shrink-0">
										{pl.coverUrl ? (
											<img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
										) : (
											<Music className="w-4 h-4" />
										)}
									</div>
									<div className="overflow-hidden">
										<p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
											{pl.title}
										</p>
										<p className="text-[10px] text-muted-foreground">
											{pl.tracks.length} 首歌曲
										</p>
									</div>
								</div>
								<Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
							</div>
						))
					)}
				</div>

				{/* Create New Playlist Inline */}
				<div className="pt-2 border-t border-white/5">
					{isCreating ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
								placeholder="新歌单名称..."
								autoFocus
								className="flex-1 h-8 px-2.5 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none"
							/>
							<button
								onClick={handleCreateAndAdd}
								disabled={!newTitle.trim()}
								className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors disabled:opacity-50"
							>
								新建并添加
							</button>
						</div>
					) : (
						<button
							onClick={() => setIsCreating(true)}
							className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
						>
							<Plus className="w-3.5 h-3.5" />
							<span>新建歌单并添加</span>
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
