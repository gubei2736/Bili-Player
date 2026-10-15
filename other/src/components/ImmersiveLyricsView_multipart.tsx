/**
 * 来源自 apps/desktop/src/components/player/ImmersiveLyricsView.tsx
 * 重点展示沉浸式全屏歌词界面中关于“分 P 标题与主稿件标题双层呈现”的核心实现
 */

import React from 'react'
import type { BilibiliTrack, Track } from '@bbplayer/shared-core'

interface ImmersiveLyricsMultipartProps {
	track: Track | null
}

export const ImmersiveLyricsMultipartSnippet: React.FC<ImmersiveLyricsMultipartProps> = ({
	track,
}) => {
	if (!track) return null

	const biliTrack = track.source === 'bilibili' ? (track as BilibiliTrack) : null

	// 判断是否是多分 P
	const isMulti = Boolean(
		biliTrack?.bilibiliMetadata?.isMultiPage &&
			(biliTrack.bilibiliMetadata.pagePart || biliTrack.bilibiliMetadata.pageIndex),
	)

	return (
		<div className="w-full flex flex-col items-center justify-center text-center">
			{/* 1. 主标题：展示当前分 P 的专属标题（如 "[P2] 02. 轨迹"） */}
			<h1
				className="text-xl md:text-2xl font-bold tracking-tight text-white/95 max-w-sm truncate"
				title={
					isMulti
						? `${biliTrack!.bilibiliMetadata.mainTrackTitle || track.title} · [P${
								biliTrack!.bilibiliMetadata.pageIndex || 1
						  }] ${biliTrack!.bilibiliMetadata.pagePart || track.title}`
						: track.title
				}
			>
				{isMulti
					? `[P${biliTrack!.bilibiliMetadata.pageIndex || 1}] ${
							biliTrack!.bilibiliMetadata.pagePart || track.title
					  }`
					: track.title || '未在播放歌曲'}
			</h1>

			{/* 2. 副标题：如果是分 P，展示主视频名称（例如周杰伦某某精选专辑），使用户清晰知道当前分 P 归属 */}
			{isMulti && biliTrack?.bilibiliMetadata?.mainTrackTitle && (
				<p
					className="text-xs text-white/50 truncate max-w-xs mt-0.5"
					title={biliTrack.bilibiliMetadata.mainTrackTitle}
				>
					{biliTrack.bilibiliMetadata.mainTrackTitle}
				</p>
			)}

			{/* 3. 歌手信息 */}
			<p className="text-xs md:text-sm text-white/70 font-medium truncate mt-1">
				{track.artist?.name || '未知歌手'}
			</p>
		</div>
	)
}
