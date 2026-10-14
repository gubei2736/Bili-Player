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
	User,
} from 'lucide-react'
import { useAuthStore } from '@bbplayer/shared-core'

export type NavTab =
	| 'explore'
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

	const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
		{ id: 'explore', label: '发现音乐', icon: <Compass className="w-4 h-4" /> },
		{ id: 'library', label: '我的音乐库', icon: <Library className="w-4 h-4" /> },
		{ id: 'favorites', label: '我喜欢的音乐', icon: <Heart className="w-4 h-4" /> },
		{ id: 'collections', label: '追更合集', icon: <FolderHeart className="w-4 h-4" /> },
		{ id: 'history', label: '播放历史', icon: <History className="w-4 h-4" /> },
		{ id: 'skins', label: '个性装扮', icon: <Palette className="w-4 h-4" /> },
		{ id: 'settings', label: '偏好设置', icon: <Settings className="w-4 h-4" /> },
	]

	return (
		<aside className="w-56 h-full flex flex-col justify-between bg-black/20 backdrop-blur-xl border-r border-white/5 select-none p-3">
			{/* Top Nav items */}
			<div className="space-y-6">
				<div className="px-3 pt-2">
					<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
						菜单
					</p>
				</div>

				<nav className="space-y-1">
					{navItems.map((item) => {
						const isActive = activeTab === item.id
						return (
							<button
								key={item.id}
								onClick={() => onSelectTab(item.id)}
								className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl font-medium transition-all duration-150 ${
									isActive
										? 'bg-primary/15 text-primary shadow-sm font-semibold'
										: 'text-foreground/75 hover:text-foreground hover:bg-white/5'
								}`}
							>
								{item.icon}
								<span>{item.label}</span>
							</button>
						)
					})}
				</nav>
			</div>

			{/* User Profile / Login status card */}
			<div className="pt-3 border-t border-white/5">
				{isLoggedIn && userInfo ? (
					<div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
						<div className="flex items-center gap-2.5 overflow-hidden">
							<img
								src={userInfo.face}
								alt={userInfo.name}
								className="w-8 h-8 rounded-full object-cover border border-white/10"
							/>
							<div className="overflow-hidden">
								<p className="text-xs font-semibold truncate text-foreground">
									{userInfo.name}
								</p>
								<p className="text-[10px] text-muted-foreground truncate">
									MID: {userInfo.mid}
								</p>
							</div>
						</div>
						<button
							onClick={logout}
							title="退出登录"
							className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
						>
							<LogOut className="w-3.5 h-3.5" />
						</button>
					</div>
				) : (
					<button
						onClick={onOpenLoginModal}
						className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500/20 to-pink-500/20 hover:from-sky-500/30 hover:to-pink-500/30 border border-white/10 text-xs font-semibold text-foreground transition-all duration-200"
					>
						<LogIn className="w-3.5 h-3.5 text-sky-400" />
						<span>B 站账号登录</span>
					</button>
				)}
			</div>
		</aside>
	)
}
