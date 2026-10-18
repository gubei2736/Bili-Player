import React from 'react'
import {
	FolderOpen,
	Sliders,
	HardDrive,
	AppWindow,
	Music,
	Sparkles,
} from 'lucide-react'
import { AudioQualitySettingsCard } from './AudioQualitySettingsCard'
import { LyricsSettingsCard } from './LyricsSettingsCard'
import { CacheSettingsCard } from './CacheSettingsCard'
import { ShortcutsSettingsView } from './ShortcutsSettingsView'

export interface SettingsViewProps {
	customExportDir: string | null
	defaultDesktopPath: string
	onPickExportDir: () => void
	onResetExportDir: () => void
	closeAction: 'tray' | 'exit'
	onSetCloseAction: (action: 'tray' | 'exit') => void
}

export const SettingsView: React.FC<SettingsViewProps> = ({
	customExportDir,
	defaultDesktopPath,
	onPickExportDir,
	onResetExportDir,
	closeAction,
	onSetCloseAction,
}) => {
	return (
		<div className="space-y-6 w-full max-w-5xl pb-16 select-none animate-in fade-in duration-200">
			{/* Page Header */}
			<div className="border-b border-white/10 pb-4">
				<div className="flex items-center gap-2">
					<Sliders className="w-5 h-5 text-[#00AEEC]" />
					<h2 className="text-lg font-bold text-foreground">偏好设置</h2>
				</div>
				<p className="text-xs text-muted-foreground mt-1">
					个性化音质表现、歌词呈现、磁盘存储、窗口系统行为与全局快捷键
				</p>
			</div>

			{/* Section 1: 音频与歌词呈现 */}
			<div className="space-y-3">
				<div className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
					<Sparkles className="w-4 h-4 text-primary" />
					<span>音频与歌词呈现</span>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
					<AudioQualitySettingsCard />
					<LyricsSettingsCard />
				</div>
			</div>

			{/* Section 2: 存储与缓存管理 */}
			<div className="space-y-3">
				<div className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
					<HardDrive className="w-4 h-4 text-[#00AEEC]" />
					<span>存储与缓存管理</span>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
					{/* Export Directory Preference Card */}
					<div className="rounded-xl bg-white/5 p-4 border border-white/5 text-xs flex flex-col justify-between space-y-3">
						<div className="space-y-1">
							<div className="flex items-center justify-between">
								<p className="font-semibold text-foreground flex items-center gap-1.5">
									<FolderOpen className="w-4 h-4 text-[#00AEEC]" />
									<span>默认音频导出目录</span>
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground">
								单曲导出为高保真 .m4a 时的本地默认保存路径
							</p>
						</div>

						<div className="space-y-2 pt-2 border-t border-white/5">
							<div
								className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-foreground font-mono text-[11px] truncate select-text"
								title={customExportDir || defaultDesktopPath || '默认系统桌面'}
							>
								{customExportDir || defaultDesktopPath || '默认系统桌面'}
							</div>
							<div className="flex items-center justify-end gap-2">
								<button
									onClick={onPickExportDir}
									className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl text-xs whitespace-nowrap transition-colors shadow-sm"
								>
									更改目录
								</button>
								{customExportDir && (
									<button
										onClick={onResetExportDir}
										className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-xl text-xs whitespace-nowrap transition-colors"
										title="恢复为系统默认桌面路径"
									>
										重置默认
									</button>
								)}
							</div>
						</div>
					</div>

					{/* Cache & Storage Management Card */}
					<CacheSettingsCard />
				</div>
			</div>

			{/* Section 3: 窗口行为与关于 */}
			<div className="space-y-3">
				<div className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
					<AppWindow className="w-4 h-4 text-purple-400" />
					<span>窗口系统行为与关于</span>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
					{/* Window Close Behavior Card */}
					<div className="rounded-xl bg-white/5 p-4 border border-white/5 text-xs flex flex-col justify-between space-y-3">
						<div>
							<p className="font-semibold text-foreground">窗口关闭按钮行为</p>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								点击主界面右上角关闭按钮时的默认系统动作
							</p>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
							<button
								onClick={() => {
									onSetCloseAction('tray')
									localStorage.setItem('bili_player_close_action', 'tray')
									localStorage.setItem('bbplayer_close_action', 'tray')
								}}
								className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
									closeAction === 'tray'
										? 'bg-[#00AEEC]/15 border-[#00AEEC]/40 text-foreground shadow-sm'
										: 'bg-white/[0.02] border-white/5 text-muted-foreground hover:bg-white/5'
								}`}
							>
								<div
									className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
										closeAction === 'tray'
											? 'border-[#00AEEC]'
											: 'border-white/30'
									}`}
								>
									{closeAction === 'tray' && (
										<div className="w-1.5 h-1.5 rounded-full bg-[#00AEEC]" />
									)}
								</div>
								<p
									className={`font-semibold ${
										closeAction === 'tray' ? 'text-[#00AEEC]' : ''
									}`}
								>
									隐藏到系统托盘
								</p>
							</button>

							<button
								onClick={() => {
									onSetCloseAction('exit')
									localStorage.setItem('bili_player_close_action', 'exit')
									localStorage.setItem('bbplayer_close_action', 'exit')
								}}
								className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
									closeAction === 'exit'
										? 'bg-[#00AEEC]/15 border-[#00AEEC]/40 text-foreground shadow-sm'
										: 'bg-white/[0.02] border-white/5 text-muted-foreground hover:bg-white/5'
								}`}
							>
								<div
									className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
										closeAction === 'exit'
											? 'border-[#00AEEC]'
											: 'border-white/30'
									}`}
								>
									{closeAction === 'exit' && (
										<div className="w-1.5 h-1.5 rounded-full bg-[#00AEEC]" />
									)}
								</div>
								<p
									className={`font-semibold ${
										closeAction === 'exit' ? 'text-[#00AEEC]' : ''
									}`}
								>
									直接退出应用
								</p>
							</button>
						</div>
					</div>

					{/* About & Version Card */}
					<div className="rounded-xl bg-white/5 p-4 border border-white/5 text-xs flex flex-col justify-between space-y-3">
						<div className="flex items-center gap-3">
							<div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#00A1D6] to-[#00AEEC] flex items-center justify-center text-white shadow-md shrink-0">
								<Music className="w-6 h-6 fill-white" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="font-bold text-foreground text-sm">
										Bili Player
									</span>
									<span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold border border-primary/30">
										V1.1.1
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									基于 Bilibili 音视频生态的沉浸式桌面 Hi-Fi 播放器
								</p>
							</div>
						</div>

						<div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-muted-foreground">
							<span>Windows x64 · Tauri 2.0 原生架构</span>
							<span className="text-emerald-400 font-medium">已是最新版本</span>
						</div>
					</div>
				</div>
			</div>

			{/* Section 4: 全局快捷键 */}
			<ShortcutsSettingsView />
		</div>
	)
}
