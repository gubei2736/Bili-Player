import React, { useState, useRef, useEffect } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar, type NavTab } from './Sidebar'
import { BottomPlayerBar } from './BottomPlayerBar'
import { useQueueStore, useCurrentTrack, useSkinStore } from '@bbplayer/shared-core'

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

	const currentTrack = useCurrentTrack()
	const customBgUrl = useSkinStore((s) => s.customBgUrl)
	const customBgType = useSkinStore((s) => s.customBgType)
	const customBgOpacity = useSkinStore((s) => s.customBgOpacity)
	const customBgBlur = useSkinStore((s) => s.customBgBlur)
	const uiBlur = useSkinStore((s) => s.uiBlur ?? 16)
	const uiOpacity = useSkinStore((s) => s.uiOpacity ?? 0.35)

	const videoRef = useRef<HTMLVideoElement | null>(null)

	// 视频壁纸后台停止播放、前台自动恢复播放机制
	useEffect(() => {
		const video = videoRef.current
		if (!video || customBgType !== 'video') return

		const handleVisibility = () => {
			if (document.hidden) {
				video.pause()
			} else {
				video.play().catch(() => {})
			}
		}

		const handleWindowBlur = () => {
			video.pause()
		}

		const handleWindowFocus = () => {
			if (!document.hidden) {
				video.play().catch(() => {})
			}
		}

		document.addEventListener('visibilitychange', handleVisibility)
		window.addEventListener('blur', handleWindowBlur)
		window.addEventListener('focus', handleWindowFocus)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibility)
			window.removeEventListener('blur', handleWindowBlur)
			window.removeEventListener('focus', handleWindowFocus)
		}
	}, [customBgUrl, customBgType])

	return (
		<div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07090e] text-foreground border border-white/10 shadow-2xl relative select-none">
			{/* 0. Custom Wallpaper Background Layer (图片或视频) */}
			{customBgUrl && (
				<div
					className="absolute inset-0 pointer-events-none z-0 overflow-hidden transition-all duration-700"
					style={{
						opacity: customBgOpacity ?? 0.5,
						filter: customBgBlur ? `blur(${customBgBlur}px)` : 'none',
					}}
				>
					{customBgType === 'video' ? (
						<video
							ref={videoRef}
							src={customBgUrl}
							autoPlay
							loop
							muted
							playsInline
							className="w-full h-full object-cover"
						/>
					) : (
						<div
							className="w-full h-full bg-cover bg-center"
							style={{
								backgroundImage: `url(${customBgUrl})`,
							}}
						/>
					)}
				</div>
			)}

			{/* 1. Ambient Dynamic Cover Glow (随当前播放歌曲封面实时晕染底层环境光) */}
			<div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
				{currentTrack?.coverUrl && !customBgUrl && (
					<img
						src={currentTrack.coverUrl}
						alt=""
						referrerPolicy="no-referrer"
						className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] object-cover blur-[120px] opacity-[0.16] saturate-200 scale-125 transition-all duration-1000"
					/>
				)}
				{/* 顶部主题色微光 (有自定义壁纸时淡化避免遮挡细节) */}
				{!customBgUrl && (
					<>
						<div className="absolute -top-32 left-1/3 w-[600px] h-[320px] rounded-full bg-primary/20 blur-[110px] opacity-60 transition-colors duration-700" />
						<div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
					</>
				)}
			</div>

			{/* 2. Top frameless title bar */}
			<TitleBar onSearch={onSearch} />

			{/* 3. Middle area: Sidebar + Inset Glass Main Viewport */}
			<div className="flex flex-1 overflow-hidden relative z-10 px-2 pb-1.5 gap-2">
				<Sidebar
					activeTab={activeTab}
					onSelectTab={setActiveTab}
					onOpenLoginModal={onOpenLoginModal}
				/>
				<main
					className="flex-1 h-full min-w-0 overflow-y-auto relative rounded-2xl border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] px-7 py-6 transition-all duration-300"
					style={{
						backgroundColor: customBgUrl
							? `rgba(7, 9, 14, ${uiOpacity})`
							: 'rgba(0, 0, 0, 0.25)',
						backdropFilter: customBgUrl
							? `blur(${uiBlur}px)`
							: 'blur(8px)',
					}}
				>
					{children(activeTab)}
				</main>
			</div>

			{/* 4. Bottom audio controller bar */}
			<BottomPlayerBar
				onToggleFullscreenLyrics={onToggleFullscreenLyrics}
				onToggleLyricsWindow={onToggleLyricsWindow}
			/>
		</div>
	)
}