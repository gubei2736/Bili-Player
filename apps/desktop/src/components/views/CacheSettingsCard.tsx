import React, { useState, useEffect } from 'react'
import { HardDrive, Trash2, CheckCircle2, ShieldCheck, Loader2, Sparkles } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

export const CacheSettingsCard: React.FC = () => {
	const [cacheBytes, setCacheBytes] = useState<number | null>(null)
	const [isCleaning, setIsCleaning] = useState(false)
	const [cleanSuccess, setCleanSuccess] = useState(false)

	const refreshCacheSize = async () => {
		try {
			const bytes = await invoke<number>('get_app_cache_size')
			setCacheBytes(bytes)
		} catch (err) {
			console.error('Failed to get cache size:', err)
		}
	}

	useEffect(() => {
		refreshCacheSize()
	}, [])

	const handleClearCache = async () => {
		setIsCleaning(true)
		setCleanSuccess(false)
		try {
			await invoke('clear_app_cache')
			await refreshCacheSize()
			setCleanSuccess(true)
			setTimeout(() => setCleanSuccess(false), 3000)
		} catch (err) {
			console.error('Failed to clear cache:', err)
		} finally {
			setIsCleaning(false)
		}
	}

	const formatSize = (bytes: number | null): string => {
		if (bytes === null) return '计算中...'
		if (bytes === 0) return '0.00 MB'
		const mb = bytes / (1024 * 1024)
		if (mb < 1) {
			return `${(bytes / 1024).toFixed(1)} KB`
		}
		return `${mb.toFixed(2)} MB`
	}

	return (
		<div className="rounded-xl bg-white/5 p-4 border border-white/5 text-xs space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<HardDrive className="w-4 h-4 text-[#00AEEC]" />
					<div>
						<p className="font-semibold text-foreground">
							缓存与磁盘空间管理
						</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">
							管理 WebView2 内核网络缓存与流媒体离线缓存
						</p>
					</div>
				</div>
				<div className="text-right">
					<span className="text-sm font-mono font-bold text-foreground">
						{formatSize(cacheBytes)}
					</span>
				</div>
			</div>

			{/* Status Badges */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
				<div className="bg-black/20 border border-white/5 rounded-lg p-2 flex items-center gap-2">
					<ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
					<div className="truncate">
						<p className="text-foreground/90 font-medium truncate">磁盘缓存上限</p>
						<p className="text-[10px] text-muted-foreground">硬锁 300MB (LRU)</p>
					</div>
				</div>
				<div className="bg-black/20 border border-white/5 rounded-lg p-2 flex items-center gap-2">
					<ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
					<div className="truncate">
						<p className="text-foreground/90 font-medium truncate">媒体缓存上限</p>
						<p className="text-[10px] text-muted-foreground">硬锁 150MB (LRU)</p>
					</div>
				</div>
				<div className="bg-black/20 border border-white/5 rounded-lg p-2 flex items-center gap-2">
					<ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
					<div className="truncate">
						<p className="text-foreground/90 font-medium truncate">CRX 组件拦截</p>
						<p className="text-[10px] text-muted-foreground">禁止静默下载</p>
					</div>
				</div>
			</div>

			<div className="flex items-center justify-between pt-1 border-t border-white/5">
				<p className="text-[10px] text-muted-foreground/80 max-w-sm">
					严格锁死在 300MB 磁盘网络缓存与 150MB 流媒体缓存以内，超额自动 LRU 淘汰。
				</p>
				<button
					onClick={handleClearCache}
					disabled={isCleaning}
					className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-all ${
						cleanSuccess
							? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
							: 'bg-white/5 hover:bg-rose-500/15 hover:text-rose-300 border border-white/10 text-muted-foreground hover:border-rose-500/30'
					}`}
				>
					{isCleaning ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : cleanSuccess ? (
						<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
					) : (
						<Trash2 className="w-3.5 h-3.5" />
					)}
					<span>{cleanSuccess ? '已清理完成' : isCleaning ? '清理中...' : '一键清理缓存'}</span>
				</button>
			</div>
		</div>
	)
}
