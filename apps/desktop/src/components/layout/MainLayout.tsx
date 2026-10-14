import React, { useState } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar, type NavTab } from './Sidebar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { useQueueStore } from '@bbplayer/shared-core'

export interface MainLayoutProps {
	children: (activeTab: NavTab) => React.ReactNode
	activeTab?: NavTab
	onSelectTab?: (tab: NavTab) => void
	onSearch?: (query: string) => void
	onToggleLyricsWindow?: () => void
	onToggleFullscreenLyrics?: () => void
	onOpenLoginModal?: () => void
}

export const MainLayout: React.FC<MainLayoutProps> = ({
	children,
	activeTab: externalActiveTab,
	onSelectTab,
	onSearch,
	onToggleLyricsWindow,
	onToggleFullscreenLyrics,
	onOpenLoginModal,
}) => {
	const [internalActiveTab, setInternalActiveTab] = useState<NavTab>('explore')
	const activeTab =
		externalActiveTab !== undefined ? externalActiveTab : internalActiveTab
	const setActiveTab = onSelectTab || setInternalActiveTab

	const currentTrack = useQueueStore((s) => s.getCurrentTrack())

	return (
		<div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07090e] text-foreground border border-white/10 shadow-2xl relative select-none">
			{/* 1. Ambient Dynamic Cover Glow (随当前播放歌曲封面实时晕染底层环境光) */}
			<div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
				{currentTrack?.coverUrl && (
					<img
						src={currentTrack.coverUrl}
						alt=""
						referrerPolicy="no-referrer"
						className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] object-cover blur-[120px] opacity-[0.16] saturate-200 scale-125 transition-all duration-1000"
					/>
				)}
				{/* 顶部主题色微光 */}
				<div className="absolute -top-32 left-1/3 w-[600px] h-[320px] rounded-full bg-primary/20 blur-[110px] opacity-60 transition-colors duration-700" />
				<div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
			</div>

			{/* 2. Top frameless title bar */}
			<TitleBar
				onSearch={onSearch}
				onToggleLyricsWindow={onToggleLyricsWindow}
			/>

			{/* 3. Middle area: Sidebar + Inset Glass Main Viewport */}
			<div className="flex flex-1 overflow-hidden relative z-10 px-2 pb-1.5 gap-2">
				<Sidebar
					activeTab={activeTab}
					onSelectTab={setActiveTab}
					onOpenLoginModal={onOpenLoginModal}
				/>
				<main className="flex-1 h-full overflow-y-auto relative rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] px-7 py-6 backdrop-blur-xl">
					{children(activeTab)}
				</main>
			</div>

			{/* 4. Bottom audio controller bar */}
			<BottomPlayerBar onToggleFullscreenLyrics={onToggleFullscreenLyrics} />
		</div>
	)
}