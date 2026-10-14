import React, { useState } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar, type NavTab } from './Sidebar'
import { BottomPlayerBar } from './BottomPlayerBar'

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
	const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab
	const setActiveTab = onSelectTab || setInternalActiveTab

	return (
		<div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0f17] text-foreground border border-white/10 shadow-2xl relative">
			{/* Top dynamic theme ambient glow */}
			<div className="absolute top-0 left-0 right-0 h-96 pointer-events-none opacity-25 bg-gradient-to-b from-primary/30 via-primary/5 to-transparent transition-all duration-700 z-0" />

			{/* Top frameless title bar */}
			<TitleBar
				onSearch={onSearch}
				onToggleLyricsWindow={onToggleLyricsWindow}
			/>

			{/* Middle area: Sidebar + Main Content */}
			<div className="flex flex-1 overflow-hidden relative z-10">
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
