import React, { useState } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar, type NavTab } from './Sidebar'
import { BottomPlayerBar } from './BottomPlayerBar'

export interface MainLayoutProps {
	children: (activeTab: NavTab) => React.ReactNode
	onSearch?: (query: string) => void
	onToggleLyricsWindow?: () => void
	onToggleFullscreenLyrics?: () => void
	onOpenLoginModal?: () => void
}

export const MainLayout: React.FC<MainLayoutProps> = ({
	children,
	onSearch,
	onToggleLyricsWindow,
	onToggleFullscreenLyrics,
	onOpenLoginModal,
}) => {
	const [activeTab, setActiveTab] = useState<NavTab>('explore')

	return (
		<div className="flex flex-col h-screen w-screen overflow-hidden bg-background/80 mica-surface text-foreground rounded-xl border border-white/10 shadow-2xl">
			{/* Top frameless title bar */}
			<TitleBar
				onSearch={onSearch}
				onToggleLyricsWindow={onToggleLyricsWindow}
			/>

			{/* Middle area: Sidebar + Main Content */}
			<div className="flex flex-1 overflow-hidden relative">
				<Sidebar
					activeTab={activeTab}
					onSelectTab={setActiveTab}
					onOpenLoginModal={onOpenLoginModal}
				/>
				<main className="flex-1 h-full overflow-y-auto relative bg-background/30 p-6">
					{children(activeTab)}
				</main>
			</div>

			{/* Bottom audio controller bar */}
			<BottomPlayerBar onToggleFullscreenLyrics={onToggleFullscreenLyrics} />
		</div>
	)
}
