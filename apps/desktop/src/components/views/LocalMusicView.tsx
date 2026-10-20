import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
	HardDrive,
	Play,
	FolderSearch,
	Loader2,
	Search,
	X,
	FolderPlus,
	Folder,
	FolderCheck,
	Tag,
	GripVertical,
	Trash2,
	Pencil,
	AlertCircle,
	Check,
	Music,
	Clock,
} from 'lucide-react'
import {
	useLocalPlaylistStore,
	useQueueStore,
	DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
	type Track,
	type PlaylistFolder,
} from '@bbplayer/shared-core'
import { invoke } from '@tauri-apps/api/core'
import { playTrackWithProxy } from '../../audio/playTrackHelper'

function formatDuration(seconds: number): string {
	if (!seconds || seconds <= 0) return '--:--'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getFileExtension(pathStr?: string): string {
	if (!pathStr) return '音频'
	const lastDot = pathStr.lastIndexOf('.')
	if (lastDot > 0 && lastDot < pathStr.length - 1) {
		return pathStr.substring(lastDot + 1).toUpperCase()
	}
	return '音频'
}

export const LocalMusicView: React.FC = () => {
	const {
		playlists,
		removeTrackFromPlaylist,
		reorderTracks,
		createFolder,
		renameFolder,
		deleteFolder,
		setTrackFolder,
		addLocalTracks,
	} = useLocalPlaylistStore()

	const localPlaylist = useMemo(() => {
		return (
			playlists.find((p) => p.id === DEFAULT_LOCAL_MUSIC_PLAYLIST_ID) || {
				id: DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
				title: '本地歌曲',
				tracks: [],
				folders: [],
				trackFolderMap: {},
			}
		)
	}, [playlists])

	const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
	const [searchKeyword, setSearchKeyword] = useState<string>('')
	const [isScanning, setIsScanning] = useState<boolean>(false)
	const [scanTip, setScanTip] = useState<string | null>(null)

	// Folder management states & modals
	const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false)
	const [newFolderName, setNewFolderName] = useState('')
	const [folderToRename, setFolderToRename] = useState<PlaylistFolder | null>(null)
	const [renameFolderName, setRenameFolderName] = useState('')
	const [folderToDelete, setFolderToDelete] = useState<PlaylistFolder | null>(null)
	const [trackForFolderSelect, setTrackForFolderSelect] = useState<Track | null>(null)
	const [trackToDelete, setTrackToDelete] = useState<Track | null>(null)

	// Drag & drop reorder states
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

	const { setQueue } = useQueueStore()

	// 1. Filter tracks by active folder
	const folderFilteredTracks = useMemo(() => {
		if (!localPlaylist) return []
		if (!activeFolderId) return localPlaylist.tracks
		return localPlaylist.tracks.filter(
			(t) => localPlaylist.trackFolderMap?.[t.uniqueKey] === activeFolderId,
		)
	}, [localPlaylist, activeFolderId])

	// 2. Filter tracks by search keyword
	const filteredTracks = useMemo(() => {
		if (!searchKeyword.trim()) return folderFilteredTracks
		const kw = searchKeyword.toLowerCase().trim()
		return folderFilteredTracks.filter(
			(t) =>
				t.title.toLowerCase().includes(kw) ||
				(t.artist?.name || '').toLowerCase().includes(kw) ||
				((t as any)?.localMetadata?.localPath || '').toLowerCase().includes(kw),
		)
	}, [folderFilteredTracks, searchKeyword])

	// Folder counts
	const folderCountMap = useMemo(() => {
		if (!localPlaylist) return {}
		const counts: Record<string, number> = {}
		const map = localPlaylist.trackFolderMap || {}
		for (const folderId of Object.values(map)) {
			counts[folderId] = (counts[folderId] || 0) + 1
		}
		return counts
	}, [localPlaylist])

	const handlePlayTrack = async (track: Track, trackList: Track[], index: number) => {
		setQueue(trackList, index)
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

			const added = addLocalTracks(DEFAULT_LOCAL_MUSIC_PLAYLIST_ID, newTracks)
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

	return (
		<div className="space-y-6">
			{/* Header Card */}
			<div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 p-6 rounded-2xl bg-white/[0.03] border border-white/5">
				<div className="w-28 h-28 rounded-2xl bg-[#00AEEC]/15 border border-[#00AEEC]/30 flex items-center justify-center text-[#00AEEC] shadow-xl flex-shrink-0">
					<HardDrive className="w-12 h-12" />
				</div>

				<div className="flex-1 space-y-2 w-full">
					<div className="flex items-center gap-2">
						<span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#00AEEC]/20 text-[#00AEEC] border border-[#00AEEC]/30">
							本地音乐库
						</span>
						<span className="text-xs text-muted-foreground">
							{searchKeyword.trim()
								? `匹配 ${filteredTracks.length} / 共 ${localPlaylist.tracks.length} 首歌曲`
								: `共 ${localPlaylist.tracks.length} 首歌曲`}
						</span>
					</div>

					<h1 className="text-2xl font-bold text-foreground">本地歌曲</h1>
					<p className="text-xs text-muted-foreground leading-relaxed">
						扫描本地电脑文件夹，离线高保真播放（支持 FLAC、MP3、WAV、M4A、OGG、AAC 等通用格式）。
					</p>

					{/* Actions Toolbar */}
					<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
						<div className="flex items-center gap-2.5">
							<button
								onClick={handlePlayAll}
								disabled={filteredTracks.length === 0}
								className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
							>
								<Play className="w-4 h-4 fill-current" />
								<span>播放全部</span>
							</button>

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
						</div>

						{/* Search Bar */}
						{localPlaylist.tracks.length > 0 && (
							<div className="relative w-full sm:w-56">
								<Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="搜索歌曲名/歌手/路径..."
									value={searchKeyword}
									onChange={(e) => setSearchKeyword(e.target.value)}
									className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
								/>
								{searchKeyword && (
									<button
										onClick={() => setSearchKeyword('')}
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

			{/* Scan tip alert banner */}
			{scanTip && (
				<div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00AEEC]/10 border border-[#00AEEC]/25 text-[#00AEEC] text-xs font-medium animate-fadeIn">
					{isScanning ? (
						<Loader2 className="w-4 h-4 animate-spin shrink-0" />
					) : (
						<FolderCheck className="w-4 h-4 shrink-0" />
					)}
					<span>{scanTip}</span>
				</div>
			)}

			{/* Folder Categories Filter Tabs */}
			{localPlaylist.tracks.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center justify-between px-1">
						<span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
							<Folder className="w-3.5 h-3.5 text-[#00AEEC]" />
							<span>本地分组</span>
						</span>
						<button
							onClick={() => {
								setNewFolderName('')
								setIsNewFolderModalOpen(true)
							}}
							className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
						>
							<FolderPlus className="w-3.5 h-3.5" />
							<span>新建分组</span>
						</button>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							onClick={() => setActiveFolderId(null)}
							className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
								activeFolderId === null
									? 'bg-primary text-white shadow-sm font-semibold'
									: 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'
							}`}
						>
							<span>全部歌曲</span>
							<span
								className={`text-[10px] px-1.5 py-0.2 rounded-full ${
									activeFolderId === null ? 'bg-white/20 text-white' : 'bg-white/10 text-muted-foreground'
								}`}
							>
								{localPlaylist.tracks.length}
							</span>
						</button>

						{(localPlaylist.folders || []).map((folder) => {
							const isSelected = activeFolderId === folder.id
							const count = folderCountMap[folder.id] || 0
							return (
								<div key={folder.id} className="relative group/folder flex items-center">
									<button
										onClick={() => setActiveFolderId(folder.id)}
										className={`pl-3 pr-7 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
											isSelected
												? 'bg-primary text-white shadow-sm font-semibold'
												: 'bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground'
										}`}
									>
										<span>{folder.name}</span>
										<span
											className={`text-[10px] px-1.5 py-0.2 rounded-full ${
												isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-muted-foreground'
											}`}
										>
											{count}
										</span>
									</button>

									{/* Folder edit actions */}
									<div className="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
										<button
											onClick={(e) => {
												e.stopPropagation()
												setFolderToRename(folder)
												setRenameFolderName(folder.name)
											}}
											className="p-1 text-muted-foreground hover:text-foreground"
											title="重命名分组"
										>
											<Pencil className="w-3 h-3" />
										</button>
										<button
											onClick={(e) => {
												e.stopPropagation()
												setFolderToDelete(folder)
											}}
											className="p-1 text-muted-foreground hover:text-red-400"
											title="删除分组"
										>
											<Trash2 className="w-3 h-3" />
										</button>
									</div>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Tracks Content Area */}
			{localPlaylist.tracks.length === 0 ? (
				<div className="p-14 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-muted-foreground space-y-4">
					<div className="w-16 h-16 rounded-2xl bg-[#00AEEC]/10 border border-[#00AEEC]/20 flex items-center justify-center text-[#00AEEC] mx-auto">
						<HardDrive className="w-8 h-8" />
					</div>
					<div className="space-y-1">
						<p className="text-sm font-semibold text-foreground">尚未导入本地音乐</p>
						<p className="text-xs text-muted-foreground">
							点击下方按钮选择电脑中存放音乐的文件夹，播放器将自动递归检索并导入所有音频文件。
						</p>
					</div>
					<button
						onClick={handleScanLocalMusic}
						disabled={isScanning}
						className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00AEEC] hover:bg-[#1bbefa] text-white text-xs font-semibold shadow-lg shadow-[#00AEEC]/25 transition-all mt-2"
					>
						{isScanning ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<FolderSearch className="w-4 h-4" />
						)}
						<span>{isScanning ? '正在扫描...' : '选择并扫描音乐文件夹'}</span>
					</button>
				</div>
			) : filteredTracks.length === 0 ? (
				<div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-muted-foreground space-y-2">
					<Search className="w-8 h-8 mx-auto opacity-30 text-primary" />
					<p className="text-sm font-semibold text-foreground/80">未找到匹配歌曲</p>
					<p className="text-xs text-muted-foreground">当前分类或搜索条件下没有找到对应本地歌曲</p>
					<div className="flex items-center justify-center gap-3 pt-2">
						{activeFolderId && (
							<button
								onClick={() => setActiveFolderId(null)}
								className="text-xs text-[#00AEEC] hover:underline font-medium"
							>
								查看全部歌曲
							</button>
						)}
						{searchKeyword && (
							<button
								onClick={() => setSearchKeyword('')}
								className="text-xs text-primary hover:underline font-medium"
							>
								清空搜索关键词
							</button>
						)}
					</div>
				</div>
			) : (
				<div className="space-y-2">
					{/* Drag tip */}
					{!searchKeyword.trim() && !activeFolderId && localPlaylist.tracks.length > 1 && (
						<div className="text-[11px] text-muted-foreground/60 px-1 flex items-center gap-1.5 select-none">
							<GripVertical className="w-3.5 h-3.5" />
							<span>按住左侧图标可自由拖动歌曲调整排序</span>
						</div>
					)}

					<div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.01]">
						<div className="divide-y divide-white/5">
							{filteredTracks.map((track, idx) => {
								const currentFolderId = localPlaylist.trackFolderMap?.[track.uniqueKey]
								const currentFolder = localPlaylist.folders?.find((f) => f.id === currentFolderId)
								const localPath = (track as any)?.localMetadata?.localPath
								const format = getFileExtension(localPath)

								const isBeingDragged = draggedIndex === idx
								const isDragOver = dragOverIndex === idx && draggedIndex !== idx

								return (
									<div
										key={track.uniqueKey || idx}
										draggable={!searchKeyword.trim() && !activeFolderId}
										onDragStart={(e) => {
											if (searchKeyword.trim() || activeFolderId) return
											setDraggedIndex(idx)
											e.dataTransfer.effectAllowed = 'move'
										}}
										onDragOver={(e) => {
											e.preventDefault()
											if (searchKeyword.trim() || activeFolderId) return
											if (draggedIndex === null || draggedIndex === idx) return
											setDragOverIndex(idx)
										}}
										onDragEnd={() => {
											setDraggedIndex(null)
											setDragOverIndex(null)
										}}
										onDrop={(e) => {
											e.preventDefault()
											if (searchKeyword.trim() || activeFolderId) return
											if (draggedIndex === null || draggedIndex === idx) return
											reorderTracks(DEFAULT_LOCAL_MUSIC_PLAYLIST_ID, draggedIndex, idx)
											setDraggedIndex(null)
											setDragOverIndex(null)
										}}
										className={`group flex items-center justify-between p-3 transition-colors ${
											isBeingDragged
												? 'opacity-30 bg-primary/20'
												: isDragOver
													? 'border-t-2 border-primary bg-primary/10'
													: 'hover:bg-white/[0.04]'
										}`}
									>
										{/* Left: Index / Drag handle & Title */}
										<div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
											{!searchKeyword.trim() && !activeFolderId ? (
												<div
													className="w-5 text-center text-xs text-muted-foreground cursor-grab active:cursor-grabbing flex items-center justify-center"
													title="拖拽排序"
												>
													<GripVertical className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
													<span className="group-hover:hidden font-mono text-[11px] text-muted-foreground/60">
														{idx + 1}
													</span>
												</div>
											) : (
												<span className="w-5 text-center font-mono text-[11px] text-muted-foreground/60">
													{idx + 1}
												</span>
											)}

											<div className="overflow-hidden space-y-0.5">
												<div className="flex items-center gap-2">
													<p
														onClick={() => handlePlayTrack(track, filteredTracks, idx)}
														className="text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer truncate"
													>
														{track.title}
													</p>
													<span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-[#00AEEC]/15 text-[#00AEEC] border border-[#00AEEC]/25">
														{format}
													</span>
													{currentFolder && (
														<span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/5 text-muted-foreground border border-white/5 flex items-center gap-1">
															<Folder className="w-2.5 h-2.5 text-sky-400" />
															<span>{currentFolder.name}</span>
														</span>
													)}
												</div>
												<p className="text-[11px] text-muted-foreground truncate">
													{track.artist?.name || '未知歌手'}
													{localPath && (
														<span className="ml-2 font-mono text-[10px] opacity-40">
															{localPath}
														</span>
													)}
												</p>
											</div>
										</div>

										{/* Right: Actions & Duration */}
										<div className="flex items-center gap-3 shrink-0">
											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<button
													onClick={() => handlePlayTrack(track, filteredTracks, idx)}
													className="p-1.5 rounded-lg hover:bg-white/10 text-primary transition-colors"
													title="播放"
												>
													<Play className="w-3.5 h-3.5 fill-current" />
												</button>

												<button
													onClick={() => setTrackForFolderSelect(track)}
													className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-sky-400 transition-colors"
													title="设置本地分组"
												>
													<Tag className="w-3.5 h-3.5" />
												</button>

												<button
													onClick={() => setTrackToDelete(track)}
													className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
													title="从本地歌曲中移除"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</div>

											<span className="text-[11px] font-mono text-muted-foreground w-12 text-right">
												{formatDuration(track.duration)}
											</span>
										</div>
									</div>
								)
							})}
						</div>
					</div>
				</div>
			)}

			{/* Modal 1: New Folder Modal */}
			{isNewFolderModalOpen &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-background/95 border border-white/10 shadow-2xl p-5 space-y-4">
							<h3 className="text-sm font-bold text-foreground">新建本地分组</h3>
							<input
								type="text"
								placeholder="请输入分组名称（如：ACG、纯音乐、车载等）"
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
								className="w-full h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 text-foreground outline-none focus:border-primary transition-colors"
								autoFocus
							/>
							<div className="flex justify-end gap-2 pt-2">
								<button
									onClick={() => setIsNewFolderModalOpen(false)}
									className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-white/5 transition-colors"
								>
									取消
								</button>
								<button
									onClick={() => {
										if (newFolderName.trim()) {
											createFolder(DEFAULT_LOCAL_MUSIC_PLAYLIST_ID, newFolderName.trim())
											setIsNewFolderModalOpen(false)
										}
									}}
									disabled={!newFolderName.trim()}
									className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
								>
									确认创建
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 2: Rename Folder Modal */}
			{folderToRename &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-background/95 border border-white/10 shadow-2xl p-5 space-y-4">
							<h3 className="text-sm font-bold text-foreground">重命名分组</h3>
							<input
								type="text"
								value={renameFolderName}
								onChange={(e) => setRenameFolderName(e.target.value)}
								className="w-full h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 text-foreground outline-none focus:border-primary transition-colors"
								autoFocus
							/>
							<div className="flex justify-end gap-2 pt-2">
								<button
									onClick={() => setFolderToRename(null)}
									className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-white/5 transition-colors"
								>
									取消
								</button>
								<button
									onClick={() => {
										if (renameFolderName.trim()) {
											renameFolder(
												DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
												folderToRename.id,
												renameFolderName.trim(),
											)
											setFolderToRename(null)
										}
									}}
									disabled={!renameFolderName.trim()}
									className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
								>
									保存
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 3: Delete Folder Confirmation Modal */}
			{folderToDelete &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-background/95 border border-white/10 shadow-2xl p-5 space-y-3">
							<div className="flex items-center gap-2 text-rose-400">
								<AlertCircle className="w-5 h-5" />
								<h3 className="text-sm font-bold">删除分组标签</h3>
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								确定删除分组 “{folderToDelete.name}” 吗？（仅删除分组标签，包含的本地歌曲不会被移除）
							</p>
							<div className="flex justify-end gap-2 pt-2">
								<button
									onClick={() => setFolderToDelete(null)}
									className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-white/5 transition-colors"
								>
									取消
								</button>
								<button
									onClick={() => {
										deleteFolder(DEFAULT_LOCAL_MUSIC_PLAYLIST_ID, folderToDelete.id)
										if (activeFolderId === folderToDelete.id) {
											setActiveFolderId(null)
										}
										setFolderToDelete(null)
									}}
									className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
								>
									确认删除
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 4: Select Track Folder Modal */}
			{trackForFolderSelect &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-background/95 border border-white/10 shadow-2xl p-5 space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-bold text-foreground">设置本地歌曲分组</h3>
								<button
									onClick={() => setTrackForFolderSelect(null)}
									className="p-1 text-muted-foreground hover:text-foreground"
								>
									<X className="w-4 h-4" />
								</button>
							</div>

							<div className="space-y-1">
								<p className="text-xs font-semibold text-foreground truncate">
									{trackForFolderSelect.title}
								</p>
								<p className="text-[10px] text-muted-foreground">选择要归属的分组标签</p>
							</div>

							<div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
								<button
									onClick={() => {
										setTrackFolder(
											DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
											trackForFolderSelect.uniqueKey,
											null,
										)
										setTrackForFolderSelect(null)
									}}
									className="w-full text-left p-2.5 rounded-xl text-xs hover:bg-white/5 transition-colors flex items-center justify-between"
								>
									<span className="text-muted-foreground">不设置分组（默认未归类）</span>
									{!localPlaylist.trackFolderMap?.[trackForFolderSelect.uniqueKey] && (
										<Check className="w-4 h-4 text-primary" />
									)}
								</button>

								{(localPlaylist.folders || []).map((f) => {
									const isCurrent =
										localPlaylist.trackFolderMap?.[trackForFolderSelect.uniqueKey] === f.id
									return (
										<button
											key={f.id}
											onClick={() => {
												setTrackFolder(
													DEFAULT_LOCAL_MUSIC_PLAYLIST_ID,
													trackForFolderSelect.uniqueKey,
													f.id,
												)
												setTrackForFolderSelect(null)
											}}
											className="w-full text-left p-2.5 rounded-xl text-xs hover:bg-white/5 transition-colors flex items-center justify-between"
										>
											<span className="text-foreground">{f.name}</span>
											{isCurrent && <Check className="w-4 h-4 text-primary" />}
										</button>
									)
								})}
							</div>
						</div>
					</div>,
					document.body,
				)}

			{/* Modal 5: Delete Track Confirmation Modal */}
			{trackToDelete &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-background/95 border border-white/10 shadow-2xl p-5 space-y-3">
							<div className="flex items-center gap-2 text-rose-400">
								<AlertCircle className="w-5 h-5" />
								<h3 className="text-sm font-bold">移除本地歌曲</h3>
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								确定从播放器列表中移除歌曲 “{trackToDelete.title}” 吗？（不会删除电脑磁盘上的原始音频文件）
							</p>
							<div className="flex justify-end gap-2 pt-2">
								<button
									onClick={() => setTrackToDelete(null)}
									className="px-3.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-white/5 transition-colors"
								>
									取消
								</button>
								<button
									onClick={() => {
										removeTrackFromPlaylist(DEFAULT_LOCAL_MUSIC_PLAYLIST_ID, trackToDelete.id)
										setTrackToDelete(null)
									}}
									className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
								>
									确认移除
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	)
}
