import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
	Heart,
	Search,
	X,
	AlertCircle,
	Pencil,
	Globe,
	RefreshCw,
	GripVertical,
	HardDrive,
	FolderSearch,
	FolderInput,
	Folder,
	FolderCheck,
	Check,
	Tag,
	Loader2,
} from 'lucide-react'
import {
	useLocalPlaylistStore,
	useQueueStore,
	DEFAULT_FAVORITES_PLAYLIST_ID,
	DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
	type Track,
	type LocalPlaylist,
	type PlaylistFolder,
} from '@bbplayer/shared-core'
import { invoke } from '@tauri-apps/api/core'
import { playTrackWithProxy } from '../../audio/playTrackHelper'
import { openExternalUrl } from '../../utils/openUrl'
import { EditPlaylistModal } from '../modals/EditPlaylistModal'
import { ReplaceTrackModal } from '../modals/ReplaceTrackModal'

export interface LibraryViewProps {
	onOpenImport: () => void
	onOpenCreate: () => void
	onExportTrack?: (track: Track) => void
	onBatchExport?: (title: string, tracks: Track[]) => void
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
	onBatchExport,
}) => {
	const {
		playlists,
		deletePlaylist,
		removeTrackFromPlaylist,
		reorderTracks,
		createFolder,
		renameFolder,
		deleteFolder,
		setTrackFolder,
		addLocalTracks,
	} = useLocalPlaylistStore()

	const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
	const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
	const [playlistToDelete, setPlaylistToDelete] = useState<LocalPlaylist | null>(null)
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)
	const [trackToReplace, setTrackToReplace] = useState<Track | null>(null)
	const [trackSearchKeyword, setTrackSearchKeyword] = useState('')
	const [playlistSearchKeyword, setPlaylistSearchKeyword] = useState('')

	// Local scanner states
	const [isScanning, setIsScanning] = useState(false)
	const [scanTip, setScanTip] = useState<string | null>(null)

	// Folder management modals & states
	const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false)
	const [newFolderName, setNewFolderName] = useState('')
	const [folderToRename, setFolderToRename] = useState<PlaylistFolder | null>(null)
	const [renameFolderName, setRenameFolderName] = useState('')
	const [folderToDelete, setFolderToDelete] = useState<PlaylistFolder | null>(null)
	const [trackForFolderSelect, setTrackForFolderSelect] = useState<Track | null>(null)

	// Drag & Drop reorder states
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

	const { setQueue } = useQueueStore()

	const currentPlaylist = playlists.find((p) => p.id === activePlaylistId)
	const isLocalPlaylist = currentPlaylist?.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID

	// 1. Filter tracks by active folder
	const folderFilteredTracks = useMemo(() => {
		if (!currentPlaylist) return []
		if (!activeFolderId) return currentPlaylist.tracks
		return currentPlaylist.tracks.filter(
			(t) => currentPlaylist.trackFolderMap?.[t.uniqueKey] === activeFolderId,
		)
	}, [currentPlaylist, activeFolderId])

	// 2. Filter tracks by search keyword
	const filteredTracks = useMemo(() => {
		if (!trackSearchKeyword.trim()) return folderFilteredTracks
		const kw = trackSearchKeyword.toLowerCase().trim()
		return folderFilteredTracks.filter(
			(t) =>
				t.title.toLowerCase().includes(kw) ||
				(t.artist?.name || '').toLowerCase().includes(kw),
		)
	}, [folderFilteredTracks, trackSearchKeyword])

	// Map of folder counts
	const folderCountMap = useMemo(() => {
		if (!currentPlaylist) return {}
		const counts: Record<string, number> = {}
		const map = currentPlaylist.trackFolderMap || {}
		for (const folderId of Object.values(map)) {
			counts[folderId] = (counts[folderId] || 0) + 1
		}
		return counts
	}, [currentPlaylist])

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

	const handleScanLocalMusic = async () => {
		if (!currentPlaylist) return
		try {
			setIsScanning(true)
			setScanTip('正在选择本地音乐文件夹...')
			const dirPath = await invoke<string | null>('pick_local_music_dir')
			if (!dirPath) {
				setIsScanning(false)
				setScanTip(null)
				return
			}
			setScanTip(`正在递归扫描目录：${dirPath}...`)
			const files = await invoke<
				Array<{
					path: string
					filename: string
					title: string
					artist: string
					size: number
					extension: string
				}>
			>('scan_local_music_dir', { dirPath })

			if (!files || files.length === 0) {
				setScanTip('所选文件夹未检索到音频文件（支持 mp3, flac, wav, m4a, ogg, aac）')
				setTimeout(() => setScanTip(null), 4000)
				setIsScanning(false)
				return
			}

			const newTracks: Track[] = files.map((f, i) => ({
				id: Date.now() + i,
				uniqueKey: `local_${encodeURIComponent(f.path)}`,
				title: f.title,
				artist: {
					id: 0,
					name: f.artist,
					source: 'local',
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				coverUrl: null,
				source: 'local',
				duration: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				localMetadata: {
					localPath: f.path,
					fileSize: f.size,
				},
			} as any))

			const added = addLocalTracks(currentPlaylist.id, newTracks)
			setScanTip(`扫描成功！新导入 ${added} 首本地歌曲（自动去重过滤）`)
			setTimeout(() => setScanTip(null), 4000)
		} catch (err: any) {
			console.error('Scan local music failed:', err)
			setScanTip(`扫描失败: ${err?.message || String(err)}`)
			setTimeout(() => setScanTip(null), 5000)
		} finally {
			setIsScanning(false)
		}
	}

	const filteredPlaylists = playlists.filter((pl) => {
		if (!playlistSearchKeyword.trim()) return true
		const kw = playlistSearchKeyword.toLowerCase().trim()
		return (
			pl.title.toLowerCase().includes(kw) ||
			(pl.intro || '').toLowerCase().includes(kw)
		)
	})

	return (
		<>
			{currentPlaylist ? (
				/* 1. Playlist Detail View */
				<div className="space-y-6">
					{/* Top bar with back button */}
					<button
						onClick={() => {
							setActivePlaylistId(null)
							setActiveFolderId(null)
							setTrackSearchKeyword('')
							setScanTip(null)
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
							) : currentPlaylist.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID ? (
								<div className="w-full h-full bg-[#00AEEC]/15 flex items-center justify-center">
									<HardDrive className="w-14 h-14 text-[#00AEEC]" />
								</div>
							) : (
								<Music className="w-12 h-12" />
							)}
						</div>

						<div className="flex-1 space-y-2 w-full">
							<div className="flex items-center gap-2">
								<span
									className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
										currentPlaylist.id === DEFAULT_FAVORITES_PLAYLIST_ID
											? 'bg-rose-500/20 text-rose-400'
											: currentPlaylist.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID
												? 'bg-[#00AEEC]/20 text-[#00AEEC]'
												: 'bg-primary/20 text-primary'
									}`}
								>
									{currentPlaylist.id === DEFAULT_FAVORITES_PLAYLIST_ID
										? '默认歌单'
										: currentPlaylist.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID
											? '本地歌单'
											: '自建歌单'}
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
							{currentPlaylist.intro &&
								currentPlaylist.id !== DEFAULT_FAVORITES_PLAYLIST_ID && (
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
										<span>
											播放全部{' '}
											{filteredTracks.length > 0 && `(${filteredTracks.length})`}
										</span>
									</button>

									{!isLocalPlaylist && (
										<button
											onClick={() => {
												const onlineTracks = currentPlaylist.tracks.filter((t) => t.source !== 'local')
												onBatchExport?.(currentPlaylist.title, onlineTracks)
											}}
											disabled={currentPlaylist.tracks.filter((t) => t.source !== 'local').length === 0}
											className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-foreground border border-white/10 text-xs font-semibold transition-colors disabled:opacity-50"
											title="批量下载此歌单在线歌曲（支持大会员最高规格）"
										>
											<Download className="w-3.5 h-3.5 text-sky-400" />
											<span>
												批量下载
												{currentPlaylist.tracks.filter((t) => t.source !== 'local').length > 0 &&
													` (${currentPlaylist.tracks.filter((t) => t.source !== 'local').length})`}
											</span>
										</button>
									)}

									{/* Local Music: Custom Directory Scan */}
									{isLocalPlaylist && (
										<button
											onClick={handleScanLocalMusic}
											disabled={isScanning}
											className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00AEEC]/15 hover:bg-[#00AEEC]/25 text-[#00AEEC] border border-[#00AEEC]/30 text-xs font-semibold transition-colors disabled:opacity-50"
											title="选择电脑中的文件夹扫描本地音乐并自动添加"
										>
											{isScanning ? (
												<Loader2 className="w-3.5 h-3.5 animate-spin" />
											) : (
												<FolderSearch className="w-3.5 h-3.5" />
											)}
											<span>{isScanning ? '正在扫描...' : '扫描本地目录'}</span>
										</button>
									)}

									{/* Edit & Delete for non-default playlists */}
									{currentPlaylist.id !== DEFAULT_FAVORITES_PLAYLIST_ID &&
										currentPlaylist.id !== DEFAULT_LOCAL_MUSIC_PLAYLIST_ID && (
											<>
												<button
													onClick={() => setIsEditModalOpen(true)}
													className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors border border-white/5"
													title="编辑歌单信息"
												>
													<Pencil className="w-3.5 h-3.5 text-sky-400" />
													<span>编辑歌单</span>
												</button>
												<button
													onClick={() => setPlaylistToDelete(currentPlaylist)}
													className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors border border-white/5"
													title="删除歌单"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</>
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

							{/* Scan Toast Tip */}
							{scanTip && (
								<div className="text-[11px] font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
									<Sparkles className="w-3.5 h-3.5 shrink-0" />
									<span>{scanTip}</span>
								</div>
							)}
						</div>
					</div>

					{/* 🌟 歌单内文件夹精细分类栏 (所有歌单均可用) */}
					<div className="flex flex-wrap items-center justify-between gap-2.5 px-1 py-1">
						<div className="flex flex-wrap items-center gap-1.5">
							{/* All tracks tag */}
							<button
								onClick={() => setActiveFolderId(null)}
								className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
									activeFolderId === null
										? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
										: 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-white/5'
								}`}
							>
								<span>全部歌曲</span>
								<span
									className={`text-[10px] px-1.5 py-0.2 rounded-full ${
										activeFolderId === null
											? 'bg-black/20 text-white'
											: 'bg-white/10 text-muted-foreground'
									}`}
								>
									{currentPlaylist.tracks.length}
								</span>
							</button>

							{/* Custom folders */}
							{(currentPlaylist.folders || []).map((f) => {
								const count = folderCountMap[f.id] || 0
								const isActive = activeFolderId === f.id
								return (
									<div
										key={f.id}
										className={`group flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-xl text-xs font-semibold transition-all ${
											isActive
												? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
												: 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-white/5'
										}`}
									>
										<span
											onClick={() => setActiveFolderId(f.id)}
											className="cursor-pointer"
										>
											{f.name}
										</span>
										<span
											onClick={() => setActiveFolderId(f.id)}
											className={`text-[10px] px-1.5 py-0.2 rounded-full cursor-pointer ${
												isActive
													? 'bg-black/20 text-white'
													: 'bg-white/10 text-muted-foreground'
											}`}
										>
											{count}
										</span>
										{/* Actions for folder */}
										<button
											onClick={(e) => {
												e.stopPropagation()
												setFolderToRename(f)
												setRenameFolderName(f.name)
											}}
											title="重命名文件夹"
											className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
												isActive ? 'hover:bg-white/20' : 'hover:bg-white/10'
											}`}
										>
											<Pencil className="w-3 h-3" />
										</button>
										<button
											onClick={(e) => {
												e.stopPropagation()
												setFolderToDelete(f)
											}}
											title="删除文件夹 (歌曲保留)"
											className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
												isActive ? 'hover:bg-white/20' : 'hover:bg-red-500/20 hover:text-red-400'
											}`}
										>
											<X className="w-3 h-3" />
										</button>
									</div>
								)
							})}
						</div>

						{/* Create folder button */}
						<button
							onClick={() => {
								setNewFolderName('')
								setIsNewFolderModalOpen(true)
							}}
							className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium shrink-0"
							title="在歌单内创建新文件夹，用于更细致的分类"
						>
							<FolderPlus className="w-3.5 h-3.5 text-sky-400" />
							<span>新建分类文件夹</span>
						</button>
					</div>

					{/* Tracks List Table */}
					{currentPlaylist.tracks.length === 0 ? (
						<div className="py-20 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-muted-foreground space-y-3">
							{currentPlaylist.id === DEFAULT_FAVORITES_PLAYLIST_ID ? (
								<>
									<Heart className="w-10 h-10 mx-auto text-rose-500/40" />
									<p className="text-sm font-semibold text-foreground/80">
										暂无我喜欢的音乐
									</p>
									<p className="text-xs text-muted-foreground">
										可在播放栏点击【爱心】图标快速添加歌曲至此歌单
									</p>
								</>
							) : currentPlaylist.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID ? (
								<>
									<HardDrive className="w-10 h-10 mx-auto text-[#00AEEC]/40" />
									<p className="text-sm font-semibold text-foreground/80">
										暂无本地音频歌曲
									</p>
									<p className="text-xs text-muted-foreground max-w-sm mx-auto">
										点击上方【扫描本地目录】按钮，选择电脑中的音乐文件夹即可自动批量导入
									</p>
									<button
										onClick={handleScanLocalMusic}
										disabled={isScanning}
										className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00AEEC] hover:bg-[#1bbefa] text-white text-xs font-semibold shadow-md transition-all mt-2"
									>
										<FolderSearch className="w-4 h-4" />
										<span>选择并扫描音乐文件夹</span>
									</button>
								</>
							) : (
								<>
									<Music className="w-8 h-8 mx-auto opacity-30" />
									<p className="text-xs">
										歌单内暂无歌曲，可在“发现”或“搜索”页面点击加入此歌单
									</p>
								</>
							)}
						</div>
					) : filteredTracks.length === 0 ? (
						<div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-muted-foreground space-y-2">
							<Search className="w-8 h-8 mx-auto opacity-30 text-primary" />
							<p className="text-sm font-semibold text-foreground/80">
								未找到匹配歌曲
							</p>
							<p className="text-xs text-muted-foreground">
								当前分类或搜索条件下没有找到对应歌曲
							</p>
							{(trackSearchKeyword || activeFolderId) && (
								<div className="flex items-center justify-center gap-3 pt-2">
									{activeFolderId && (
										<button
											onClick={() => setActiveFolderId(null)}
											className="text-xs text-sky-400 hover:underline font-medium"
										>
											切换回全部歌曲
										</button>
									)}
									{trackSearchKeyword && (
										<button
											onClick={() => setTrackSearchKeyword('')}
											className="text-xs text-primary hover:underline font-medium"
										>
											清空搜索关键词
										</button>
									)}
								</div>
							)}
						</div>
					) : (
						<div className="space-y-2">
							{/* Drag tip when list can be reordered */}
							{!trackSearchKeyword.trim() &&
								!activeFolderId &&
								currentPlaylist.tracks.length > 1 && (
									<div className="text-[11px] text-muted-foreground/60 px-1 flex items-center gap-1.5 select-none">
										<GripVertical className="w-3.5 h-3.5" />
										<span>按住左侧图标可自由拖动歌曲调整排序</span>
									</div>
								)}

							<div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.01]">
								<div className="divide-y divide-white/5">
									{filteredTracks.map((track, idx) => {
										const bvid =
											(track as any).bilibiliMetadata?.bvid || (track as any).bvid
										const isLocal =
											isLocalPlaylist ||
											track.source === 'local' ||
											Boolean((track as any)?.localMetadata?.localPath)

										const currentFolderId =
											currentPlaylist.trackFolderMap?.[track.uniqueKey]
										const currentFolder = currentPlaylist.folders?.find(
											(f) => f.id === currentFolderId,
										)

										const isBeingDragged = draggedIndex === idx
										const isDragOver =
											dragOverIndex === idx && draggedIndex !== idx

										return (
											<div
												key={track.uniqueKey || idx}
												draggable={!trackSearchKeyword.trim() && !activeFolderId}
												onDragStart={(e) => {
													if (trackSearchKeyword.trim() || activeFolderId) return
													setDraggedIndex(idx)
													e.dataTransfer.effectAllowed = 'move'
												}}
												onDragOver={(e) => {
													e.preventDefault()
													if (trackSearchKeyword.trim() || activeFolderId) return
													if (draggedIndex === null || draggedIndex === idx) return
													setDragOverIndex(idx)
												}}
												onDrop={(e) => {
													e.preventDefault()
													if (trackSearchKeyword.trim() || activeFolderId) return
													if (draggedIndex !== null && draggedIndex !== idx) {
														reorderTracks(currentPlaylist.id, draggedIndex, idx)
													}
													setDraggedIndex(null)
													setDragOverIndex(null)
												}}
												onDragEnd={() => {
													setDraggedIndex(null)
													setDragOverIndex(null)
												}}
												onClick={() =>
													handlePlayTrack(track, filteredTracks, idx)
												}
												className={`group flex items-center justify-between p-3 hover:bg-white/5 transition-all cursor-pointer text-xs ${
													isBeingDragged
														? 'opacity-30 bg-primary/10 border-dashed border border-primary'
														: ''
												} ${isDragOver ? 'bg-primary/20 border-t-2 border-primary' : ''}`}
											>
												<div className="flex items-center gap-3 flex-1 overflow-hidden mr-4">
													{/* Drag Handle & Index */}
													<div className="w-6 flex items-center justify-center flex-shrink-0 text-muted-foreground">
														{!trackSearchKeyword.trim() && !activeFolderId ? (
															<>
																<span className="text-[11px] font-mono group-hover:hidden">
																	{(idx + 1).toString().padStart(2, '0')}
																</span>
																<GripVertical className="w-3.5 h-3.5 hidden group-hover:block cursor-grab active:cursor-grabbing text-muted-foreground/80 hover:text-foreground" />
															</>
														) : (
															<span className="text-[11px] font-mono">
																{(idx + 1).toString().padStart(2, '0')}
															</span>
														)}
													</div>

													<div className="w-9 h-9 rounded-lg bg-black/40 overflow-hidden flex-shrink-0 relative group/cover flex items-center justify-center">
														{track.coverUrl ? (
															<img
																src={track.coverUrl}
																alt=""
																referrerPolicy="no-referrer"
																className="w-full h-full object-cover"
															/>
														) : isLocal ? (
															<HardDrive className="w-4 h-4 text-sky-400/80" />
														) : (
															<Music className="w-4 h-4 text-muted-foreground/60" />
														)}
														<div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white">
															<Play className="w-3.5 h-3.5 fill-current" />
														</div>
													</div>

													<div className="overflow-hidden space-y-0.5">
														<div className="flex items-center gap-2 overflow-hidden">
															<p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
																{track.title}
															</p>
															{/* Folder badge if classified */}
															{currentFolder && (
																<span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-sky-500/15 text-sky-400 border border-sky-500/25 shrink-0">
																	{currentFolder.name}
																</span>
															)}
														</div>
														<p className="text-[11px] text-muted-foreground truncate">
															{track.artist?.name || (isLocal ? '本地音乐' : '未知歌手')}
														</p>
													</div>
												</div>

												<div className="flex items-center gap-3 text-muted-foreground">
													<span className="text-[11px] font-mono">
														{track.duration > 0
															? formatDuration(track.duration)
															: '--:--'}
													</span>

													<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
														{/* Set / Move to folder in current playlist */}
														<button
															onClick={(e) => {
																e.stopPropagation()
																setTrackForFolderSelect(track)
															}}
															title="归类到文件夹"
															className="p-1 rounded hover:bg-sky-500/20 text-muted-foreground hover:text-sky-400 transition-colors"
														>
															<FolderInput className="w-3.5 h-3.5" />
														</button>

														{/* Online only: Open Video Webpage */}
														{!isLocal && bvid && (
															<button
																onClick={(e) => {
																	e.stopPropagation()
																	const pageIndex = (track as any).bilibiliMetadata
																		?.pageIndex
																	const url = `https://www.bilibili.com/video/${bvid}${pageIndex && pageIndex > 1 ? `?p=${pageIndex}` : ''}`
																	openExternalUrl(url)
																}}
																title="在默认浏览器打开 B 站视频网页"
																className="p-1 rounded hover:bg-sky-500/20 text-muted-foreground hover:text-sky-400 transition-colors"
															>
																<Globe className="w-3.5 h-3.5" />
															</button>
														)}

														{/* Online only: Search and Replace Audio Source */}
														{!isLocal && (
															<button
																onClick={(e) => {
																	e.stopPropagation()
																	setTrackToReplace(track)
																}}
																title="搜索并替换音频源"
																className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
															>
																<RefreshCw className="w-3.5 h-3.5" />
															</button>
														)}

														{/* Online only: Export to m4a (本地歌曲不需要导出音频选项) */}
														{!isLocal && onExportTrack && (
															<button
																onClick={(e) => {
																	e.stopPropagation()
																	onExportTrack(track)
																}}
																title="导出为 .m4a"
																className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
															>
																<Download className="w-3.5 h-3.5" />
															</button>
														)}

														<button
															onClick={(e) => {
																e.stopPropagation()
																removeTrackFromPlaylist(
																	currentPlaylist.id,
																	track.uniqueKey,
																)
															}}
															title="从歌单移除"
															className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
														>
															<Trash2 className="w-3.5 h-3.5" />
														</button>
													</div>
												</div>
											</div>
										)
									})}
								</div>
							</div>
						</div>
					)}
				</div>
			) : (
				/* 2. Playlists Grid View */
				<div className="space-y-5">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h2 className="text-base font-bold text-foreground">我的音乐库</h2>
							<p className="text-xs text-muted-foreground mt-0.5">
								管理本地专属曲库、扫描目录与自建分类歌单
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
								<p className="text-sm font-semibold text-foreground">
									暂无本地歌单
								</p>
								<p className="text-xs text-muted-foreground max-w-sm mx-auto">
									点击上方“新建歌单”即可创建专属自定义歌单，或使用“导入网易云/QQ歌单”同步外部音乐。
								</p>
							</div>
						</div>
					) : filteredPlaylists.length === 0 ? (
						<div className="p-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-muted-foreground space-y-2">
							<Search className="w-8 h-8 mx-auto opacity-30 text-primary" />
							<p className="text-sm font-semibold text-foreground">未找到匹配歌单</p>
							<p className="text-xs text-muted-foreground">
								没有找到与 “{playlistSearchKeyword}” 相关的歌单
							</p>
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
										setActiveFolderId(null)
										setTrackSearchKeyword('')
										setScanTip(null)
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
											) : pl.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID ? (
												<div className="w-full h-full bg-[#00AEEC]/15 flex items-center justify-center">
													<HardDrive className="w-6 h-6 text-[#00AEEC]" />
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
											{pl.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID && (
												<span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#00AEEC]/15 text-[#00AEEC] font-semibold border border-[#00AEEC]/30">
													本地
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
											{pl.intro ||
												(pl.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID
													? '本地自定义目录扫描音乐'
													: '本地自定义歌单')}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Modal 1: Custom Delete Playlist Confirmation Modal */}
			{playlistToDelete &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-[#0e131f]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
									<AlertCircle className="w-5 h-5" />
								</div>
								<div>
									<h3 className="font-bold text-sm text-foreground">
										删除歌单确认
									</h3>
									<p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
										确定要删除歌单【
										<span className="text-foreground font-semibold">
											{playlistToDelete.title}
										</span>
										】吗？删除后不可恢复。
									</p>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									onClick={() => setPlaylistToDelete(null)}
									className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-medium transition-colors"
								>
									取消
								</button>
								<button
									onClick={() => {
										deletePlaylist(playlistToDelete.id)
										setPlaylistToDelete(null)
										setActivePlaylistId(null)
										setActiveFolderId(null)
										setTrackSearchKeyword('')
									}}
									className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium transition-colors shadow-md shadow-rose-500/20 active:scale-95"
								>
									确认删除
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 2: Create Folder in Playlist */}
			{isNewFolderModalOpen &&
				currentPlaylist &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-[#0e131f]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
									<FolderPlus className="w-5 h-5" />
								</div>
								<div>
									<h3 className="font-bold text-sm text-foreground">
										新建分类文件夹
									</h3>
									<p className="text-[11px] text-muted-foreground mt-0.5">
										在歌单【{currentPlaylist.title}】中创建分类
									</p>
								</div>
							</div>

							<input
								type="text"
								placeholder="输入文件夹名称 (如: 华语经典、纯音乐)..."
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && newFolderName.trim()) {
										createFolder(currentPlaylist.id, newFolderName)
										setIsNewFolderModalOpen(false)
										setNewFolderName('')
									}
								}}
								autoFocus
								className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-sky-500/60"
							/>

							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									onClick={() => setIsNewFolderModalOpen(false)}
									className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-medium transition-colors"
								>
									取消
								</button>
								<button
									disabled={!newFolderName.trim()}
									onClick={() => {
										createFolder(currentPlaylist.id, newFolderName)
										setIsNewFolderModalOpen(false)
										setNewFolderName('')
									}}
									className="px-3.5 py-1.5 rounded-xl bg-[#00AEEC] hover:bg-[#1bbefa] text-white font-medium transition-colors disabled:opacity-50"
								>
									创建文件夹
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 3: Rename Folder */}
			{folderToRename &&
				currentPlaylist &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-[#0e131f]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
									<Pencil className="w-4 h-4" />
								</div>
								<div>
									<h3 className="font-bold text-sm text-foreground">
										重命名分类文件夹
									</h3>
									<p className="text-[11px] text-muted-foreground mt-0.5">
										修改文件夹名称
									</p>
								</div>
							</div>

							<input
								type="text"
								value={renameFolderName}
								onChange={(e) => setRenameFolderName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && renameFolderName.trim()) {
										renameFolder(currentPlaylist.id, folderToRename.id, renameFolderName)
										setFolderToRename(null)
									}
								}}
								autoFocus
								className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-foreground focus:outline-none focus:border-sky-500/60"
							/>

							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									onClick={() => setFolderToRename(null)}
									className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-medium transition-colors"
								>
									取消
								</button>
								<button
									disabled={!renameFolderName.trim()}
									onClick={() => {
										renameFolder(currentPlaylist.id, folderToRename.id, renameFolderName)
										setFolderToRename(null)
									}}
									className="px-3.5 py-1.5 rounded-xl bg-[#00AEEC] hover:bg-[#1bbefa] text-white font-medium transition-colors disabled:opacity-50"
								>
									保存修改
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 4: Delete Folder Confirmation */}
			{folderToDelete &&
				currentPlaylist &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-[#0e131f]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
									<AlertCircle className="w-5 h-5" />
								</div>
								<div>
									<h3 className="font-bold text-sm text-foreground">
										删除文件夹确认
									</h3>
									<p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
										确定删除文件夹【
										<span className="text-foreground font-semibold">
											{folderToDelete.name}
										</span>
										】吗？该文件夹内的所有歌曲将自动还原为未分类，
										<span className="text-sky-400 font-semibold">
											不会从歌单中删除歌曲
										</span>
										。
									</p>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									onClick={() => setFolderToDelete(null)}
									className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-medium transition-colors"
								>
									取消
								</button>
								<button
									onClick={() => {
										if (activeFolderId === folderToDelete.id) {
											setActiveFolderId(null)
										}
										deleteFolder(currentPlaylist.id, folderToDelete.id)
										setFolderToDelete(null)
									}}
									className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors shadow-md shadow-amber-500/20 active:scale-95"
								>
									确认删除
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 5: Assign Track to Folder */}
			{trackForFolderSelect &&
				currentPlaylist &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-[#0e131f]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<FolderInput className="w-4 h-4 text-sky-400" />
									<h3 className="font-bold text-sm text-foreground truncate max-w-[240px]">
										分类至文件夹
									</h3>
								</div>
								<button
									onClick={() => setTrackForFolderSelect(null)}
									className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
								>
									<X className="w-4 h-4" />
								</button>
							</div>

							<p className="text-[11px] text-muted-foreground truncate">
								歌曲：{trackForFolderSelect.title}
							</p>

							{/* Folder List */}
							<div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
								{/* Unclassified option */}
								<div
									onClick={() => {
										setTrackFolder(
											currentPlaylist.id,
											trackForFolderSelect.uniqueKey,
											null,
										)
										setTrackForFolderSelect(null)
									}}
									className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
										!currentPlaylist.trackFolderMap?.[
											trackForFolderSelect.uniqueKey
										]
											? 'bg-primary/20 text-primary border border-primary/30'
											: 'bg-white/5 hover:bg-white/10 text-foreground'
									}`}
								>
									<span className="font-medium">未分类 (根目录)</span>
									{!currentPlaylist.trackFolderMap?.[
										trackForFolderSelect.uniqueKey
									] && <Check className="w-4 h-4" />}
								</div>

								{/* Created folders */}
								{(currentPlaylist.folders || []).map((f) => {
									const isCurrent =
										currentPlaylist.trackFolderMap?.[
											trackForFolderSelect.uniqueKey
										] === f.id
									return (
										<div
											key={f.id}
											onClick={() => {
												setTrackFolder(
													currentPlaylist.id,
													trackForFolderSelect.uniqueKey,
													f.id,
												)
												setTrackForFolderSelect(null)
											}}
											className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
												isCurrent
													? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
													: 'bg-white/5 hover:bg-white/10 text-foreground'
											}`}
										>
											<div className="flex items-center gap-2">
												<Folder className="w-4 h-4 text-sky-400/70" />
												<span className="font-medium">{f.name}</span>
											</div>
											{isCurrent && <Check className="w-4 h-4" />}
										</div>
									)
								})}
							</div>

							<div className="flex items-center justify-between pt-1 border-t border-white/5">
								<button
									onClick={() => {
										setTrackForFolderSelect(null)
										setNewFolderName('')
										setIsNewFolderModalOpen(true)
									}}
									className="text-xs text-sky-400 hover:underline flex items-center gap-1"
								>
									<FolderPlus className="w-3.5 h-3.5" />
									<span>新建文件夹</span>
								</button>
								<button
									onClick={() => setTrackForFolderSelect(null)}
									className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-medium transition-colors"
								>
									完成
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Edit Playlist Modal */}
			<EditPlaylistModal
				isOpen={isEditModalOpen}
				playlist={currentPlaylist || null}
				onClose={() => setIsEditModalOpen(false)}
			/>

			{/* Replace Track Modal */}
			{trackToReplace && currentPlaylist && (
				<ReplaceTrackModal
					isOpen={!!trackToReplace}
					playlistId={currentPlaylist.id}
					targetTrack={trackToReplace}
					onClose={() => setTrackToReplace(null)}
				/>
			)}
		</>
	)
}
