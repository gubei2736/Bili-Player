import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import {
	Compass,
	Library,
	Heart,
	FolderHeart,
	History,
	Palette,
	Settings,
	LogIn,
	LogOut,
	Sparkles,
	AlertCircle,
} from 'lucide-react'
import { useAuthStore, useSkinStore, useQueueStore } from '@bbplayer/shared-core'
import { loginQrService } from '../../services/loginQrService'
import { desktopAudioEngine } from '../../audio/DesktopAudioEngine'

export type NavTab =
	| 'explore'
	| 'search'
	| 'library'
	| 'favorites'
	| 'collections'
	| 'history'
	| 'skins'
	| 'settings'

export interface SidebarProps {
	activeTab: NavTab
	onSelectTab: (tab: NavTab) => void
	onOpenLoginModal?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
	activeTab,
	onSelectTab,
	onOpenLoginModal,
}) => {
	const { isLoggedIn, userInfo, logout } = useAuthStore()
	const customBgUrl = useSkinStore((s) => s.customBgUrl)
	const customTextColor = useSkinStore((s) => s.customTextColor)
	const uiBlur = useSkinStore((s) => s.uiBlur ?? 16)
	const uiOpacity = useSkinStore((s) => s.uiOpacity ?? 0.35)
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

	const discoverGroup: { id: NavTab; label: string; icon: React.ReactNode }[] = [
		{ id: 'explore', label: '发现音乐', icon: <Compass className="w-4 h-4" /> },
		{ id: 'library', label: '我的音乐库', icon: <Library className="w-4 h-4" /> },
	]

	const myMusicGroup: { id: NavTab; label: string; icon: React.ReactNode }[] = [
		{ id: 'favorites', label: '我的收藏', icon: <Heart className="w-4 h-4" /> },
		{ id: 'collections', label: '追更合集', icon: <FolderHeart className="w-4 h-4" /> },
		{ id: 'history', label: '收听足迹', icon: <History className="w-4 h-4" /> },
	]

	const systemGroup: { id: NavTab; label: string; icon: React.ReactNode }[] = [
		{ id: 'skins', label: '个性装扮', icon: <Palette className="w-4 h-4" /> },
		{ id: 'settings', label: '偏好设置', icon: <Settings className="w-4 h-4" /> },
	]

	const renderNavButton = (item: {
		id: NavTab
		label: string
		icon: React.ReactNode
	}) => {
		const isActive = activeTab === item.id
		return (
			<button
				key={item.id}
				onClick={() => onSelectTab(item.id)}
				style={customTextColor ? { color: customTextColor } : undefined}
				className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 text-xs rounded-xl transition-all duration-200 ${
					isActive
						? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/25'
						: 'hover:bg-white/[0.04] border border-transparent'
				}`}
			>
				{/* 左侧流光胶囊指示条 */}
				{isActive && (
					<span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.9)]" />
				)}
				<span
					className={`transition-transform duration-200 ${
						isActive
							? 'text-primary scale-105'
							: 'group-hover:scale-105'
					}`}
					style={
						!isActive
							? customTextColor
								? { color: customTextColor, opacity: 0.85 }
								: undefined
							: undefined
					}
				>
					{item.icon}
				</span>
				<span
					className="truncate"
					style={
						customTextColor
							? { color: customTextColor, opacity: isActive ? 1 : 0.85 }
							: undefined
					}
				>
					{item.label}
				</span>
			</button>
		)
	}

	return (
		<aside
			style={{
				...(customTextColor ? { color: customTextColor } : {}),
				backgroundColor: customBgUrl
					? `rgba(7, 9, 14, ${uiOpacity})`
					: 'rgba(0, 0, 0, 0.25)',
				backdropFilter: customBgUrl
					? `blur(${uiBlur}px)`
					: 'blur(12px)',
			}}
			className="w-56 h-full flex flex-col justify-between rounded-2xl border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] select-none p-3 transition-all duration-300"
		>
			{/* Top Nav Groups */}
			<div className="space-y-5 overflow-y-auto no-scrollbar pt-1">
				<div className="space-y-1">
					<p
						className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
						style={customTextColor ? { color: customTextColor, opacity: 0.65 } : undefined}
					>
						音乐馆
					</p>
					{discoverGroup.map(renderNavButton)}
				</div>

				<div className="space-y-1">
					<p
						className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
						style={customTextColor ? { color: customTextColor, opacity: 0.65 } : undefined}
					>
						我的私享
					</p>
					{myMusicGroup.map(renderNavButton)}
				</div>

				<div className="space-y-1">
					<p
						className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
						style={customTextColor ? { color: customTextColor, opacity: 0.65 } : undefined}
					>
						个性化与系统
					</p>
					{systemGroup.map(renderNavButton)}
				</div>
			</div>

			{/* Bottom User Profile / Login Pod */}
			<div className="pt-3 border-t border-white/[0.08]">
				{isLoggedIn && userInfo ? (
					<div
						className="flex items-center justify-between p-2.5 rounded-xl backdrop-blur-sm border border-white/[0.06] hover:border-white/15 transition-all duration-300"
						style={{
							backgroundColor: customBgUrl
								? 'rgba(255, 255, 255, 0.05)'
								: 'rgba(255, 255, 255, 0.04)',
						}}
					>
						<div className="flex items-center gap-2.5 overflow-hidden">
							<div className="relative flex-shrink-0">
								<img
									src={userInfo.face}
									alt={userInfo.name}
									referrerPolicy="no-referrer"
									className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/40"
								/>
							</div>
							<div className="overflow-hidden">
								<p
									className="text-xs font-bold truncate text-foreground"
									style={customTextColor ? { color: customTextColor } : undefined}
									title={userInfo.name}
								>
									{userInfo.name}
								</p>
							</div>
						</div>
						<button
							onClick={() => setShowLogoutConfirm(true)}
							title="退出当前账号"
							className="p-1.5 rounded-lg hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors flex-shrink-0"
						>
							<LogOut className="w-3.5 h-3.5" />
						</button>
					</div>
				) : customBgUrl ? (
					/* 自定义背景下：按钮为纯透明/微透光玻璃质感，完全融入自定义背景，去除彩虹渐变和深黑底 */
					<button
						onClick={onOpenLoginModal}
						onMouseEnter={() => loginQrService.getOrFetch()}
						style={customTextColor ? { color: customTextColor } : undefined}
						className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 hover:border-white/35 backdrop-blur-sm text-xs font-medium text-white transition-all active:scale-[0.98] shadow-sm"
					>
						<LogIn className="w-3.5 h-3.5 text-white/90" style={customTextColor ? { color: customTextColor } : undefined} />
						<span style={customTextColor ? { color: customTextColor } : undefined}>扫码连接 B 站账号</span>
					</button>
				) : (
					/* 默认背景下：柔和素雅的科技微光边框，去除刺眼的霓虹彩虹色 */
					<button
						onClick={onOpenLoginModal}
						onMouseEnter={() => loginQrService.getOrFetch()}
						style={customTextColor ? { color: customTextColor } : undefined}
						className="group relative w-full overflow-hidden rounded-xl p-[1px] transition-all duration-300 hover:shadow-md hover:shadow-primary/15 active:scale-[0.98]"
					>
						<div className="absolute inset-0 bg-gradient-to-r from-primary/35 via-sky-400/25 to-primary/35 opacity-70 group-hover:opacity-100 transition-opacity" />
						<div className="relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-[11px] bg-black/40 group-hover:bg-black/25 backdrop-blur-sm text-xs font-medium text-white transition-all">
							<LogIn className="w-3.5 h-3.5 text-primary/90 group-hover:scale-105 transition-transform" style={customTextColor ? { color: customTextColor } : undefined} />
							<span style={customTextColor ? { color: customTextColor } : undefined}>扫码连接 B 站账号</span>
							<Sparkles className="w-3 h-3 text-sky-300/70 opacity-80" />
						</div>
					</button>
				)}
			</div>

			{/* Logout Confirmation Dialog Modal */}
			{showLogoutConfirm &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
						<div className="w-full max-w-sm rounded-2xl bg-[#0e131f]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-5 space-y-4 text-xs">
							<div className="flex items-center gap-3">
								<div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
									<AlertCircle className="w-5 h-5" />
								</div>
								<div>
									<h3 className="font-bold text-sm text-foreground">确认退出账号？</h3>
									<p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
										退出登录后将清空当前播放队列并停止播放。
									</p>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 pt-1">
								<button
									onClick={() => setShowLogoutConfirm(false)}
									className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-medium transition-colors"
								>
									取消
								</button>
								<button
									onClick={() => {
										logout()
										useQueueStore.getState().clearQueue()
										desktopAudioEngine.stop()
										setShowLogoutConfirm(false)
									}}
									className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium transition-colors shadow-md shadow-rose-500/20 active:scale-95"
								>
									确认退出
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</aside>
	)
}