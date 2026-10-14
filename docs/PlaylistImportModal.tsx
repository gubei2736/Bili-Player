import React, { useState } from 'react'
import {
	X,
	Download,
	Music,
	CheckCircle2,
	AlertCircle,
	Loader2,
	Sparkles,
} from 'lucide-react'
import {
	externalPlaylistService,
	type GenericPlaylist,
	type GenericTrack,
	type MatchResult,
	useLocalPlaylistStore,
	type Track,
} from '@bbplayer/shared-core'

export interface PlaylistImportModalProps {
	isOpen: boolean
	onClose: () => void
	onImportSuccess?: () => void
}

export const PlaylistImportModal: React.FC<PlaylistImportModalProps> = ({
	isOpen,
	onClose,
	onImportSuccess,
}) => {
	const [inputVal, setInputVal] = useState('')
	const [step, setStep] = useState<'input' | 'fetching' | 'matching' | 'done'>(
		'input',
	)
	const [progressText, setProgressText] = useState('')
	const [playlist, setPlaylist] = useState<GenericPlaylist | null>(null)
	const [tracks, setTracks] = useState<GenericTrack[]>([])
	const [matchResults, setMatchResults] = useState<MatchResult[]>([])
	const [error, setError] = useState<string | null>(null)

	if (!isOpen) return null

	const parseInput = (
		raw: string,
	): { id: string; source: 'netease' | 'qq' } | null => {
		const str = raw.trim()
		if (!str) return null

		// 1. QQ 音乐识别
		if (str.includes('qq.com')) {
			const m =
				str.match(/playlist\/(\d+)/) ||
				str.match(/taoge\.html\?id=(\d+)/) ||
				str.match(/[?&]id=(\d+)/) ||
				str.match(/[?&]dissid=(\d+)/) ||
				str.match(/[?&]disstid=(\d+)/)
			if (m && m[1]) return { id: m[1], source: 'qq' }
		}

		// 2. 网易云音乐识别
		if (str.includes('163.com') || str.includes('163cn.tv')) {
			const m =
				str.match(/playlist\/(\d+)/) ||
				str.match(/[?&]id=(\d+)/) ||
				str.match(/playlist\?id=(\d+)/)
			if (m && m[1]) return { id: m[1], source: 'netease' }
		}

		// 3. 通用参数匹配 (包含在整段分享文字中)
		const generalIdMatch =
			str.match(/[?&]id=(\d+)/) || str.match(/[?&]dissid=(\d+)/)
		if (generalIdMatch && generalIdMatch[1]) {
			return {
				id: generalIdMatch[1],
				source: str.includes('qq') ? 'qq' : 'netease',
			}
		}

		// 4. 纯数字歌单 ID
		const pureDigits = str.match(/\b\d{5,12}\b/)
		if (pureDigits) {
			return { id: pureDigits[0], source: 'netease' }
		}

		return null
	}

	const handleStartImport = async () => {
		if (!inputVal.trim()) return
		setError(null)
		setStep('fetching')
		setProgressText('正在解析歌单元数据与歌曲列表...')

		const parsed = parseInput(inputVal)
		if (!parsed) {
			setError(
				'未能识别出有效的歌单 ID 或链接，请确认粘贴了包含 id=数字 的完整分享链接或纯数字歌单 ID',
			)
			setStep('input')
			return
		}
		const { id, source } = parsed
		const fetchRes = await externalPlaylistService.fetchExternalPlaylist(id, source)

		if (fetchRes.isErr()) {
			setError(`获取歌单失败: ${fetchRes.error.message}`)
			setStep('input')
			return
		}

		const data = fetchRes.value
		setPlaylist(data.playlist)
		setTracks(data.tracks)
		setStep('matching')
		setProgressText(`已获取 ${data.tracks.length} 首歌曲，正在匹配 B 站音频源...`)

		const matchRes = await externalPlaylistService.matchExternalPlaylist(
			data.tracks.slice(0, 30), // Match first 30 tracks for speed
			(current: number, total: number, result: MatchResult) => {
				setProgressText(
					`正在匹配 (${current}/${total}): ${result.track.title}`,
				)
			},
		)

		if (matchRes.isErr()) {
			setError(`智能匹配出错: ${matchRes.error.message}`)
			setStep('input')
			return
		}

		setMatchResults(matchRes.value)
		setStep('done')
		if (onImportSuccess) {
			onImportSuccess()
		}
	}

	const handleReset = () => {
		setStep('input')
		setInputVal('')
		setError(null)
		setPlaylist(null)
		setTracks([])
		setMatchResults([])
	}

	const handleConfirmImport = () => {
		const confirmedTracks: Track[] = matchResults
			.filter((item) => item.matchedVideo !== null)
			.map((item, idx) => ({
				id: Date.now() + idx,
				uniqueKey: `bilibili_${item.matchedVideo!.bvid}_0`,
				title: item.track.title,
				artist: {
					id: item.matchedVideo!.mid || idx + 1000,
					name: item.track.artists.join(', ') || item.matchedVideo!.author || 'B站音乐',
					source: 'bilibili' as const,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				coverUrl: (item.matchedVideo!.pic || item.track.coverUrl || '').replace('http://', 'https://'),
				duration: typeof item.matchedVideo!.duration === 'number'
					? item.matchedVideo!.duration
					: typeof item.matchedVideo!.duration === 'string' && item.matchedVideo!.duration.includes(':')
					? item.matchedVideo!.duration.split(':').reduce((acc: number, time: string) => 60 * acc + +time, 0)
					: Number(item.matchedVideo!.duration) || Math.round(item.track.duration / 1000) || 0,
				source: 'bilibili' as const,
				createdAt: new Date(),
				updatedAt: new Date(),
				bilibiliMetadata: {
					bvid: item.matchedVideo!.bvid,
					cid: null,
					isMultiPage: false,
					videoIsValid: true,
				},
			}))

		useLocalPlaylistStore
			.getState()
			.createPlaylist(
				playlist?.title || '导入外部歌单',
				playlist?.description,
				playlist?.coverUrl,
				confirmedTracks,
			)

		onImportSuccess?.()
		onClose()
	}

	const matchedCount = matchResults.filter((r) => r.matchedVideo !== null).length

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
			<div className="w-full max-w-lg rounded-2xl bg-background/95 border border-white/10 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-white/5">
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
							<Sparkles className="w-3.5 h-3.5" />
						</div>
						<h3 className="text-sm font-bold text-foreground">
							外部歌单智能导入向导
						</h3>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Body Content */}
				{step === 'input' && (
					<div className="space-y-4">
						<p className="text-xs text-muted-foreground leading-relaxed">
							支持粘贴网易云音乐、QQ音乐的歌单分享链接或 ID，系统将全自动解析歌曲，并通过高精度声学模型智能关联匹配 B 站高清无损音频源。
						</p>

						<div className="space-y-1.5">
							<label className="text-[11px] font-semibold text-foreground/80">
								歌单分享链接 / ID
							</label>
							<input
								type="text"
								value={inputVal}
								onChange={(e) => setInputVal(e.target.value)}
								placeholder="例如: https://music.163.com/playlist?id=123456"
								className="w-full h-9 px-3 text-xs rounded-xl bg-white/5 border border-white/10 focus:border-primary/50 text-foreground placeholder:text-muted-foreground outline-none"
							/>
						</div>

						{error && (
							<div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
								<AlertCircle className="w-4 h-4 flex-shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={onClose}
								className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-white/5 transition-colors"
							>
								取消
							</button>
							<button
								onClick={handleStartImport}
								disabled={!inputVal.trim()}
								className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-md"
							>
								开始解析与匹配
							</button>
						</div>
					</div>
				)}

				{(step === 'fetching' || step === 'matching') && (
					<div className="py-8 flex flex-col items-center justify-center space-y-3">
						<Loader2 className="w-8 h-8 text-primary animate-spin" />
						<p className="text-xs font-medium text-foreground">
							{progressText}
						</p>
						<p className="text-[11px] text-muted-foreground">
							正在进行标题分词清洗、持续时间高斯核匹配与声学打分...
						</p>
					</div>
				)}

				{step === 'done' && (
					<div className="space-y-4">
						<div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
							<CheckCircle2 className="w-5 h-5 flex-shrink-0" />
							<div>
								<p className="font-semibold">歌单匹配解析完成！</p>
								<p className="text-[11px] text-emerald-300/80">
									{playlist?.title}: 共 {matchResults.length} 首歌曲，成功匹配 {matchedCount} 首 B 站音频源
								</p>
							</div>
						</div>

						<div className="max-h-48 overflow-y-auto space-y-1.5 p-1">
							{matchResults.map((item, idx) => (
								<div
									key={idx}
									className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-xs"
								>
									<div className="overflow-hidden">
										<p className="font-medium truncate text-foreground">
											{item.track.title}
										</p>
										<p className="text-[10px] text-muted-foreground truncate">
											{item.track.artists.join(', ')}
										</p>
									</div>
									<span
										className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
											item.matchedVideo
												? 'bg-emerald-500/15 text-emerald-400'
												: 'bg-red-500/15 text-red-400'
										}`}
									>
										{item.matchedVideo ? '已匹配' : '未找到'}
									</span>
								</div>
							))}
						</div>

						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={handleReset}
								className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-white/5 transition-colors"
							>
								导入其他歌单
							</button>
							<button
								onClick={handleConfirmImport}
								disabled={matchedCount === 0}
								className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
							>
								<CheckCircle2 className="w-3.5 h-3.5" />
								<span>确认导入至我的音乐库 ({matchedCount} 首)</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
