import React, { useState } from 'react'
import {
	FolderPlus,
	Import,
	Music,
	Play,
	Trash2,
	Clock,
	ArrowLeft,
	Download,
	Sparkles,
	MoreVertical,
	Heart,
	Search,
	X,
} from 'lucide-react'
import {
	useLocalPlaylistStore,
	useQueueStore,
	DEFAULT_FAVORITES_PLAYLIST_ID,
	type Track,
	type LocalPlaylist,
} from '@bbplayer/shared-core'
import { playTrackWithProxy } from '../../audio/playTrackHelper'

export interface LibraryViewProps {
	onOpenImport: () => void
	onOpenCreate: () => void
	onExportTrack?: (track: Track) => void
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const LibraryView: React.FC<LibraryViewProps> = ({
	onOpenImport,
	onOpenCreate,
	onExportTrack,
}) => {
	const { playlists, deletePlaylist, removeTrackFromPlaylist } = useLocalPlaylistStore()
	const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
	const [trackSearchKeyword, setTrackSearchKeyword] = useState('')
	const [playlistSearchKeyword, setPlaylistSearchKeyword] = useState('')
	const { setQueue } = useQueueStore()

	const currentPlaylist = playlists.find((p) => p.id === activePlaylistId)

	const filteredTracks = currentPlaylist
		? currentPlaylist.tracks.filter((t) => {
				if (!trackSearchKeyword.trim()) return true
				const kw = trackSearchKeyword.toLowerCase().trim()
				return (
					t.title.toLowerCase().includes(kw) ||
					(t.artist?.name || '').toLowerCase().includes(kw)
				)
		  })
		: []

	const handlePlayTrack = async (track: Track, tracks: Track[], index: number) => {
		setQueue(tracks, index)
		try {
			await playTrackWithProxy(track)
		} catch (err) {
			console.error('Play track failed:', err)
		}
	}

	const handlePlayAll = () => {
		if (filteredTracks.length > 0) {
			handlePlayTrack(filteredTracks[0]!, filteredTracks, 0)
		}
	}

	// 1. Playlist Detail View
	if (currentPlaylist) {
		return (
			<div className="space-y-6">
				{/* Top bar with back button */}
				<button
					onClick={() => {
						setActivePlaylistId(null)
						setTrackSearchKeyword('')
					}}
					className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>返回我的歌单</span>
				</button>

				{/* Playlist Header */}
				<div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 p-6 rounded-2xl bg-white/[0.03] border border-white/5">
					<div className="w-32 h-32 rounded-xl bg-primary/20 flex items-center justify-center text-primary overflow-hidden flex-shrink-0 shadow-xl border border-white/10">
						{currentPlaylist.coverUrl ? (
							<img
								src={currentPlaylist.coverUrl}
								alt=""
								referrerPolicy="no-referrer"
								className="w-full h-full object-cover"
							/>
						) : currentPlaylist.id === DEFAULT_FAVORITES_PLAYLIST_ID ? (
							<div className="w-full h-full bg-rose-500/10 flex items-center justify-center">
								<Heart className="w-14 h-14 text-rose-500 fill-rose-500" />
							</div>
						) : (
							<Music className="w-12 h-12" />
						)}
					</div>

					<div className="flex-1 space-y-2 w-full">
						<div className="flex items-center gap-2">
							<span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
								currentPlaylist.id === DEFAULT_FAVORITES_PLAYLIST_ID
									? 'bg-rose-500/20 text-rose-400'
									: 'bg-primary/20 text-primary'
							}`}>
								{currentPlaylist.id === DEFAULT_FAVORITES_PLAYLIST_ID ? '默认歌单' : '本地歌单'}
							</span>
							<span className="text-xs text-muted-foreground">
								{trackSearchKeyword.trim()
									? `匹配 ${filteredTracks.length} / 共 ${currentPlaylist.tracks.length} 首歌曲`
									: `共 ${currentPlaylist.tracks.length} 首歌曲`}
							</span>
						</div>
						<h1 className="text-2xl font-bold text-foreground">
							{currentPlaylist.title}
						</h1>
						{currentPlaylist.intro && currentPlaylist.id !== DEFAULT_FAVORITES_PLAYLIST_ID && (
							<p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
								{currentPlaylist.intro}
							</p>
						)}

						{/* Action toolbar & Search input */}
						<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
							<div className="flex items-center gap-2.5">
								<button
									onClick={handlePlayAll}
									disabled={filteredTracks.length === 0}
									className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
								>
									<Play className="w-4 h-4 fill-current" />
									<span>播放全部 {filteredTracks.length > 0 && `(${filteredTracks.length})`}</span>
								</button>

								{currentPlaylist.id !== DEFAULT_FAVORITES_PLAYLIST_ID && (
									<button
										onClick={() => {
											if (window.confirm(`确定要删除歌单【${currentPlaylist.title}】吗？`)) {
												deletePlaylist(currentPlaylist.id)
												setActivePlaylistId(null)
												setTrackSearchKeyword('')
											}
										}}
										className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
										title="删除歌单"
									>
										<Trash2 className="w-4 h-4" />
									</button>
								)}
							</div>

							{/* Search input in Playlist Detail */}
							{currentPlaylist.tracks.length > 0 && (
								<div className="relative w-full sm:w-64">
									<Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
									<input
										type="text"
										placeholder="搜索歌单内的歌曲、歌手..."
										value={trackSearchKeyword}
										onChange={(e) => setTrackSearchKeyword(e.target.value)}
										className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
									/>
									{trackSearchKeyword && (
										<button
											onClick={() => setTrackSearchKeyword('')}
											className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
										>
											<X className="w-3.5 h-3.5" />
										</button>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Tracks List Table */}
				{currentPlaylist.tracks.length === 0 ? (
					<div className="py-20 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-muted-foreground space-y-2">
						{currentPlaylist.id === DEFAULT_FAVORITES_PLAYLIST_ID ? (
							<>
								<Heart className="w-10 h-10 mx-auto text-rose-500/40" />
								<p className="text-sm font-semibold text-foreground/80">暂无我喜欢的音乐</p>
								<p className="text-xs text-muted-foreground">可在播放栏点击【爱心】图标快速添加歌曲至此歌单</p>
							</>
						) : (
							<>
								<Music className="w-8 h-8 mx-auto opacity-30" />
								<p className="text-xs">歌单内暂无歌曲，可在“发现”或“搜索”页面点击加入此歌单</p>
							</>
						)}
					</div>
				) : filteredTracks.length === 0 ? (
					<div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-muted-foreground space-y-2">
						<Search className="w-8 h-8 mx-auto opacity-30 text-primary" />
						<p className="text-sm font-semibold text-foreground/80">未找到匹配歌曲</p>
						<p className="text-xs text-muted-foreground">没有找到与 “{trackSearchKeyword}” 相关的歌曲或歌手</p>
						<button
							onClick={() => setTrackSearchKeyword('')}
							className="text-xs text-primary hover:underline mt-2 inline-block font-medium"
						>
							清空搜索关键词
						</button>
					</div>
				) : (
					<div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.01]">
						<div className="divide-y divide-white/5">
							{filteredTracks.map((track, idx) => (
								<div
									key={track.uniqueKey || idx}
									onClick={() => handlePlayTrack(track, filteredTracks, idx)}
									className="group flex items-center justify-between p-3 hover:bg-white/5 transition-colors cursor-pointer text-xs"
								>
									<div className="flex items-center gap-3 flex-1 overflow-hidden mr-4">
										<span className="w-6 text-center text-muted-foreground text-[11px] font-mono group-hover:hidden">
											{(idx + 1).toString().padStart(2, '0')}
										</span>
										<div className="w-6 hidden group-hover:flex items-center justify-center text-primary">
											<Play className="w-3.5 h-3.5 fill-current" />
										</div>

										<div className="w-9 h-9 rounded-lg bg-black/40 overflow-hidden flex-shrink-0">
											<img
												src={track.coverUrl || undefined}
												alt=""
												referrerPolicy="no-referrer"
												className="w-full h-full object-cover"
											/>
										</div>

										<div className="overflow-hidden space-y-0.5">
											<p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
												{track.title}
											</p>
											<p className="text-[11px] text-muted-foreground truncate">
												{track.artist?.name || '未知歌手'}
											</p>
										</div>
									</div>

									<div className="flex items-center gap-4 text-muted-foreground">
										<span className="text-[11px] font-mono">
											{formatDuration(track.duration || 180)}
										</span>

										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											{onExportTrack && (
												<button
													onClick={(e) => {
														e.stopPropagation()
														onExportTrack(track)
													}}
													title="导出为 .m4a"
													className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
												>
													<Download className="w-3.5 h-3.5" />
												</button>
											)}
											<button
												onClick={(e) => {
													e.stopPropagation()
													removeTrackFromPlaylist(currentPlaylist.id, track.uniqueKey)
												}}
												title="从歌单移除"
												className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		)
	}

	const filteredPlaylists = playlists.filter((pl) => {
		if (!playlistSearchKeyword.trim()) return true
		const kw = playlistSearchKeyword.toLowerCase().trim()
		return (
			pl.title.toLowerCase().includes(kw) ||
			(pl.intro || '').toLowerCase().includes(kw)
		)
	})

	// 2. Playlists Grid View
	return (
		<div className="space-y-5">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h2 className="text-base font-bold text-foreground">我的音乐库</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						管理本地自建歌单与导入的专属曲库
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{playlists.length > 0 && (
						<div className="relative w-44 sm:w-52">
							<Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
							<input
								type="text"
								placeholder="搜索本地歌单..."
								value={playlistSearchKeyword}
								onChange={(e) => setPlaylistSearchKeyword(e.target.value)}
								className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
							/>
							{playlistSearchKeyword && (
								<button
									onClick={() => setPlaylistSearchKeyword('')}
									className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
								>
									<X className="w-3.5 h-3.5" />
								</button>
							)}
						</div>
					)}
					<button
						onClick={onOpenImport}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-semibold transition-colors"
					>
						<Import className="w-3.5 h-3.5" />
						<span>导入歌单</span>
					</button>
					<button
						onClick={onOpenCreate}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-all"
					>
						<FolderPlus className="w-3.5 h-3.5" />
						<span>新建歌单</span>
					</button>
				</div>
			</div>

			{playlists.length === 0 ? (
				<div className="p-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-3">
					<div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-muted-foreground/60">
						<FolderPlus className="w-6 h-6" />
					</div>
					<div className="space-y-1">
						<p className="text-sm font-semibold text-foreground">暂无本地歌单</p>
						<p className="text-xs text-muted-foreground max-w-sm mx-auto">
							点击上方“新建歌单”即可创建专属自定义歌单，或使用“导入网易云/QQ歌单”同步外部音乐。
						</p>
					</div>
				</div>
			) : filteredPlaylists.length === 0 ? (
				<div className="p-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-2">
					<Search className="w-8 h-8 mx-auto opacity-30 text-primary" />
					<p className="text-sm font-semibold text-foreground">未找到匹配歌单</p>
					<p className="text-xs text-muted-foreground">没有找到与 “{playlistSearchKeyword}” 相关的歌单</p>
					<button
						onClick={() => setPlaylistSearchKeyword('')}
						className="text-xs text-primary hover:underline mt-1 inline-block font-medium"
					>
						清空搜索
					</button>
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
					{filteredPlaylists.map((pl) => (
						<div
							key={pl.id}
							onClick={() => {
								setActivePlaylistId(pl.id)
								setTrackSearchKeyword('')
							}}
							className="group p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all cursor-pointer flex flex-col justify-between space-y-3"
						>
							<div className="flex items-center justify-between">
								<div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform overflow-hidden relative">
									{pl.coverUrl ? (
										<img
											src={pl.coverUrl}
											alt=""
											referrerPolicy="no-referrer"
											className="w-full h-full object-cover"
										/>
									) : pl.id === DEFAULT_FAVORITES_PLAYLIST_ID ? (
										<div className="w-full h-full bg-rose-500/15 flex items-center justify-center">
											<Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
										</div>
									) : (
										<Music className="w-6 h-6" />
									)}
								</div>
								<div className="flex items-center gap-1.5">
									{pl.id === DEFAULT_FAVORITES_PLAYLIST_ID && (
										<span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/30">
											默认
										</span>
									)}
									<span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
										{pl.tracks.length} 首
									</span>
								</div>
							</div>

							<div>
								<p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
									{pl.title}
								</p>
								<p className="text-[10px] text-muted-foreground mt-0.5 truncate">
									{pl.intro || '本地自定义歌单'}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
