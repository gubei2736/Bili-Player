import React from 'react'
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
} from 'lucide-react'
import { useAuthStore } from '@bbplayer/shared-core'

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
				className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 text-xs rounded-xl transition-all duration-200 ${
					isActive
						? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-primary/25'
						: 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent'
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
							: 'text-muted-foreground group-hover:text-foreground group-hover:scale-105'
					}`}
				>
					{item.icon}
				</span>
				<span className="truncate">{item.label}</span>
			</button>
		)
	}

	return (
		<aside className="w-56 h-full flex flex-col justify-between rounded-2xl bg-black/25 border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md select-none p-3">
			{/* Top Nav Groups */}
			<div className="space-y-5 overflow-y-auto no-scrollbar pt-1">
				<div className="space-y-1">
					<p className="px-3 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
						音乐馆
					</p>
					{discoverGroup.map(renderNavButton)}
				</div>

				<div className="space-y-1">
					<p className="px-3 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
						我的私享
					</p>
					{myMusicGroup.map(renderNavButton)}
				</div>

				<div className="space-y-1">
					<p className="px-3 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
						个性化与系统
					</p>
					{systemGroup.map(renderNavButton)}
				</div>
			</div>

			{/* Bottom User Profile / Login Pod */}
			<div className="pt-3 border-t border-white/[0.08]">
				{isLoggedIn && userInfo ? (
					<div className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 backdrop-blur-sm border border-white/[0.08] shadow-inner">
						<div className="flex items-center gap-2.5 overflow-hidden">
							<div className="relative flex-shrink-0">
								<img
									src={userInfo.face}
									alt={userInfo.name}
									referrerPolicy="no-referrer"
									className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/40"
								/>
								<span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0b0f17]" />
							</div>
							<div className="overflow-hidden">
								<p className="text-xs font-bold truncate text-foreground">
									{userInfo.name}
								</p>
								<p className="text-[10px] text-emerald-400/90 font-medium truncate">
									Bilibili 已连接
								</p>
							</div>
						</div>
						<button
							onClick={logout}
							title="退出登录"
							className="p-1.5 rounded-lg hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors flex-shrink-0"
						>
							<LogOut className="w-3.5 h-3.5" />
						</button>
					</div>
				) : (
					<button
						onClick={onOpenLoginModal}
						className="group relative w-full overflow-hidden rounded-xl p-[1px] transition-all duration-300 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
					>
						<div className="absolute inset-0 bg-gradient-to-r from-primary via-pink-500 to-sky-400 opacity-60 group-hover:opacity-100 transition-opacity" />
						<div className="relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-[11px] bg-black/45 group-hover:bg-black/30 backdrop-blur-sm text-xs font-semibold text-white transition-all">
							<LogIn className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
							<span>扫码连接 B 站账号</span>
							<Sparkles className="w-3 h-3 text-pink-300 opacity-90" />
						</div>
					</button>
				)}
			</div>
		</aside>
	)
}