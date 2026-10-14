import React, { useState, useEffect } from 'react'
import {
	Keyboard,
	RotateCcw,
	Check,
	Sparkles,
	AlertTriangle,
	CheckCircle2,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

export interface ShortcutItem {
	id: string
	key: string
	description: string
}

export interface ShortcutStatus {
	id: string
	key: string
	registered: boolean
	error: string | null
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
	{
		id: 'play_pause',
		key: 'Ctrl+Alt+Space',
		description: '全局：播放 / 暂停',
	},
	{
		id: 'prev_track',
		key: 'Ctrl+Alt+ArrowLeft',
		description: '全局：上一首',
	},
	{
		id: 'next_track',
		key: 'Ctrl+Alt+ArrowRight',
		description: '全局：下一首',
	},
	{
		id: 'toggle_lyrics',
		key: 'Ctrl+Alt+D',
		description: '全局：显示/隐藏桌面歌词',
	},
	{
		id: 'toggle_penetration',
		key: 'Ctrl+Alt+L',
		description: '全局：切换歌词鼠标穿透',
	},
]

export const ShortcutsSettingsView: React.FC = () => {
	const [shortcuts, setShortcuts] = useState<ShortcutItem[]>(() => {
		const saved = localStorage.getItem('bbplayer_shortcuts')
		if (saved) {
			try {
				return JSON.parse(saved)
			} catch {}
		}
		return DEFAULT_SHORTCUTS
	})

	const [editingId, setEditingId] = useState<string | null>(null)
	const [saveStatus, setSaveStatus] = useState<string | null>(null)
	const [statusMap, setStatusMap] = useState<Record<string, ShortcutStatus>>({})

	const applyStatuses = (list: ShortcutStatus[]) => {
		if (!Array.isArray(list)) return
		const nextMap: Record<string, ShortcutStatus> = {}
		for (const item of list) {
			nextMap[item.id] = item
		}
		setStatusMap(nextMap)
	}

	useEffect(() => {
		const saved = localStorage.getItem('bbplayer_shortcuts')
		if (saved) {
			try {
				const parsed = JSON.parse(saved)
				if (Array.isArray(parsed) && parsed.length > 0) {
					setShortcuts(parsed)
					invoke<ShortcutStatus[]>('update_shortcuts', { configs: parsed })
						.then(applyStatuses)
						.catch(() => {})
					return
				}
			} catch {}
		}
		invoke<ShortcutItem[]>('get_shortcuts')
			.then((items) => {
				if (items && items.length > 0) {
					setShortcuts(items)
					return invoke<ShortcutStatus[]>('update_shortcuts', {
						configs: items,
					})
				}
				return []
			})
			.then((statuses) => {
				if (statuses) applyStatuses(statuses)
			})
			.catch(() => {})
	}, [])

	const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
		e.preventDefault()
		e.stopPropagation()

		// 忽略单独按下的修饰键
		if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
			return
		}

		const modifiers: string[] = []
		if (e.ctrlKey) modifiers.push('Ctrl')
		if (e.altKey) modifiers.push('Alt')
		if (e.shiftKey) modifiers.push('Shift')
		if (e.metaKey) modifiers.push('Super')

		let mainKey = e.key
		if (e.code === 'Space' || mainKey === ' ' || mainKey === 'Spacebar') {
			mainKey = 'Space'
		} else if (mainKey === 'ArrowLeft' || e.code === 'ArrowLeft') {
			mainKey = 'ArrowLeft'
		} else if (mainKey === 'ArrowRight' || e.code === 'ArrowRight') {
			mainKey = 'ArrowRight'
		} else if (mainKey === 'ArrowUp' || e.code === 'ArrowUp') {
			mainKey = 'ArrowUp'
		} else if (mainKey === 'ArrowDown' || e.code === 'ArrowDown') {
			mainKey = 'ArrowDown'
		} else if (e.code.startsWith('Key') && e.code.length === 4) {
			mainKey = e.code.slice(3).toUpperCase()
		} else if (e.code.startsWith('Digit') && e.code.length === 6) {
			mainKey = e.code.slice(5)
		} else if (mainKey.length === 1) {
			mainKey = mainKey.toUpperCase()
		}

		const shortcutString =
			modifiers.length > 0 ? `${modifiers.join('+')}+${mainKey}` : mainKey

		const updated = shortcuts.map((s) =>
			s.id === id ? { ...s, key: shortcutString } : s,
		)
		setShortcuts(updated)
		setEditingId(null)
		saveShortcuts(updated)
	}

	const saveShortcuts = async (items: ShortcutItem[]) => {
		localStorage.setItem('bbplayer_shortcuts', JSON.stringify(items))
		window.dispatchEvent(
			new CustomEvent('bbplayer-shortcuts-updated', { detail: items }),
		)
		try {
			const statuses = await invoke<ShortcutStatus[]>('update_shortcuts', {
				configs: items,
			})
			applyStatuses(statuses)
			const failedCount = statuses.filter((s) => !s.registered).length
			if (failedCount === 0) {
				setSaveStatus('全部全局热键已在系统中成功注册并生效')
			} else {
				setSaveStatus(
					`已保存配置，但有 ${failedCount} 个热键未能注册为后台全局热键（详见下方提示）`,
				)
			}
			setTimeout(() => setSaveStatus(null), 3500)
		} catch (err: any) {
			console.warn('Update shortcuts note:', err)
			setSaveStatus('已保存本地快捷键')
			setTimeout(() => setSaveStatus(null), 2500)
		}
	}

	const handleReset = () => {
		setShortcuts(DEFAULT_SHORTCUTS)
		saveShortcuts(DEFAULT_SHORTCUTS)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
						<Keyboard className="w-4 h-4 text-primary" />
						<span>自定义全局快捷键</span>
					</h3>
					<p className="text-[11px] text-muted-foreground mt-0.5">
						点击右侧键位按钮直接按下组合键录制（后台全局热键需包含 Ctrl / Alt / Shift 修饰键）
					</p>
				</div>
				<button
					onClick={handleReset}
					className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					<RotateCcw className="w-3 h-3" />
					<span>恢复默认</span>
				</button>
			</div>

			{saveStatus && (
				<div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
					<Check className="w-3.5 h-3.5 shrink-0" />
					<span>{saveStatus}</span>
				</div>
			)}

			<div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-muted-foreground space-y-1">
				<p className="text-foreground font-semibold flex items-center gap-1.5">
					<Sparkles className="w-3.5 h-3.5 text-primary" />
					<span>前台与后台热键机制说明</span>
				</p>
				<p className="text-[11px] leading-relaxed">
					1. <strong>前台单键</strong>：应用处于焦点时，直接按{' '}
					<kbd className="px-1.5 py-0.5 rounded bg-white/10 text-primary font-mono text-[10px]">
						Space
					</kbd>{' '}
					即可播放/暂停。<br />
					2. <strong>后台全局热键</strong>：当切换到浏览器或其他软件时，需使用带修饰键的组合（如{' '}
					<code className="text-foreground/90">Ctrl+Alt+Space</code>）。若显示“热键被占用”，说明与当前电脑上的 QQ/微信/显卡驱动热键冲突，点击更换为其他组合（如{' '}
					<code className="text-foreground/90">Ctrl+Shift+Space</code> 或{' '}
					<code className="text-foreground/90">Alt+P</code>）即可立即生效。
				</p>
			</div>

			<div className="space-y-2 rounded-xl bg-white/5 p-3 border border-white/5">
				{shortcuts.map((item) => {
					const isEditing = editingId === item.id
					const st = statusMap[item.id]
					const hasError = st && !st.registered

					return (
						<div
							key={item.id}
							className="flex flex-col py-2 px-2.5 rounded-lg hover:bg-white/5 transition-colors text-xs gap-1.5"
						>
							<div className="flex items-center justify-between">
								<div className="flex-1 mr-4">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground">
											{item.description}
										</p>
										{st?.registered && (
											<span
												className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400"
												title="已在操作系统成功注册全局热键，后台失焦可用"
											>
												<CheckCircle2 className="w-2.5 h-2.5" />
												<span>全局已就绪</span>
											</span>
										)}
										{hasError && (
											<span
												className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400"
												title={st.error || '热键冲突'}
											>
												<AlertTriangle className="w-2.5 h-2.5" />
												<span>热键冲突/受限</span>
											</span>
										)}
									</div>
									<p className="text-[10px] text-muted-foreground font-mono mt-0.5">
										ID: {item.id}
									</p>
								</div>

								<div>
									{isEditing ? (
										<div
											ref={(el) => el?.focus()}
											tabIndex={0}
											onKeyDown={(e) => handleKeyDown(e, item.id)}
											onBlur={() => setEditingId(null)}
											className="px-3 py-1.5 rounded-lg bg-primary/20 border border-primary text-primary text-xs font-mono animate-pulse cursor-pointer outline-none"
										>
											请按下组合键...
										</div>
									) : (
										<button
											onClick={() => setEditingId(item.id)}
											className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all duration-150 ${
												hasError
													? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:border-amber-400'
													: 'bg-white/10 hover:bg-white/15 border-white/10 text-foreground hover:border-primary/50'
											}`}
										>
											{item.key || '未设置'}
										</button>
									)}
								</div>
							</div>

							{hasError && st.error && (
								<p className="text-[10px] text-amber-400/90 flex items-center gap-1 pl-0.5">
									<span>⚠️ {st.error}（建议点击右侧按钮录制其他组合键）</span>
								</p>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
