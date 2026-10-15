/**
 * 来源自 apps/desktop/src/components/layout/BottomPlayerBar.tsx
 * 重点展示底栏播放条中关于“视频分 P 标题格式化”与“选集胶囊按钮”的核心实现
 */

import React, { useState } from 'react'
import { Layers, Maximize2 } from 'lucide-react'
import type { BilibiliTrack, Track } from '@bbplayer/shared-core'
import { VideoPartsModal } from './VideoPartsModal'

interface BottomPlayerBarMultipartProps {
	currentTrack: Track | null
	onToggleFullscreenLyrics?: () => void
}

export const BottomPlayerBarMultipartSnippet: React.FC<BottomPlayerBarMultipartProps> = ({
	currentTrack,
	onToggleFullscreenLyrics,
}) => {
	const [partsModalOpen, setPartsModalOpen] = useState(false)

	if (!currentTrack) return null

	const biliTrack = currentTrack.source === 'bilibili' ? (currentTrack as BilibiliTrack) : null

	// 1. 判断是否是多分 P，并动态格式化分 P 标题
	const isMulti = Boolean(
		biliTrack?.bilibiliMetadata?.isMultiPage &&
			(biliTrack.bilibiliMetadata.pagePart || biliTrack.bilibiliMetadata.pageIndex),
	)

	// 格式化展示规则：如果是分 P，展示 `[P1] 01. 晴天`；否则展示歌曲常规原标题
	const displayTitle = isMulti
		? `[P${biliTrack!.bilibiliMetadata.pageIndex || 1}] ${
				biliTrack!.bilibiliMetadata.pagePart || currentTrack.title
		  }`
		: currentTrack.title

	// 悬浮 Tooltip：主标题 · [P1] 01. 晴天
	const tooltipTitle = isMulti
		? `${biliTrack!.bilibiliMetadata.mainTrackTitle || currentTrack.title} · ${displayTitle}`
		: currentTrack.title

	return (
		<div className="flex items-center gap-3">
			<div className="overflow-hidden space-y-0.5">
				<div className="flex items-center gap-1.5 overflow-hidden">
					{/* 歌曲主标题 */}
					<p
						onClick={onToggleFullscreenLyrics}
						className="text-xs font-bold truncate hover:text-[#00AEEC] cursor-pointer text-foreground transition-colors"
						title={tooltipTitle}
					>
						{displayTitle}
					</p>

					{/* 2. 分 P 选集胶囊按钮：显示例如 "P1/10"，点击弹出选集模态框 */}
					{biliTrack?.bilibiliMetadata?.isMultiPage && (
						<button
							onClick={() => setPartsModalOpen(true)}
							className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-[#00AEEC]/15 hover:bg-[#00AEEC]/25 text-[#00AEEC] border border-[#00AEEC]/30 shrink-0 transition-colors"
							title="点击查看并切换本视频所有分 P 选集"
						>
							<Layers className="w-2.5 h-2.5" />
							<span>
								P{biliTrack.bilibiliMetadata.pageIndex || 1}/
								{biliTrack.bilibiliMetadata.pages?.length || 1}
							</span>
						</button>
					)}
				</div>

				<p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
					{currentTrack.artist?.name || '未知歌手'}
				</p>
			</div>

			{/* 3. 分 P 选集交互弹窗挂载 */}
			{biliTrack && (
				<VideoPartsModal
					isOpen={partsModalOpen}
					onClose={() => setPartsModalOpen(false)}
					bvid={biliTrack.bilibiliMetadata.bvid}
					title={biliTrack.bilibiliMetadata.mainTrackTitle || currentTrack.title || '视频选集'}
					coverUrl={currentTrack.coverUrl}
					author={currentTrack.artist?.name}
					currentCid={biliTrack.bilibiliMetadata.cid}
					currentPage={biliTrack.bilibiliMetadata.pageIndex || 1}
					initialParts={biliTrack.bilibiliMetadata.pages}
				/>
			)}
		</div>
	)
}
