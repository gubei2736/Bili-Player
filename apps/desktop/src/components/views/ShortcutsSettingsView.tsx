import React, { useState, useEffect } from 'react'
import { Keyboard, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

export interface ShortcutItem {
	id: string
	key: string
	description: string
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
	{
		id: 'play_pause',
		key: 'Alt+Shift+Space',
		description: '全局：播放 / 暂停',
	},
	{
		id: 'prev_track',
		key: 'Alt+Shift+Left',
		description: '全局：上一首',
	},
	{
		id: 'next_track',
		key: 'Alt+Shift+Right',
		description: '全局：下一首',
	},
	{
		id: 'toggle_lyrics',
		key: 'Alt+Shift+D',
		description: '全局：显示/隐藏桌面歌词',
	},
	{
		id: 'toggle_penetration',
		key: 'Alt+Shift+L',
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

	useEffect(() => {
		invoke<ShortcutItem[]>('get_shortcuts')
			.then((items) => {
				if (items && items.length > 0) {
					setShortcuts(items)
				}
			})
			.catch(() => {})
	}, [])

	const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
		e.preventDefault()
		e.stopPropagation()

		// Discard isolated modifier presses
		if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
			return
		}

		const modifiers: string[] = []
		if (e.ctrlKey) modifiers.push('Ctrl')
		if (e.altKey) modifiers.push('Alt')
		if (e.shiftKey) modifiers.push('Shift')
		if (e.metaKey) modifiers.push('Super')

		let mainKey = e.key
		if (mainKey === ' ' || mainKey === 'Spacebar') mainKey = 'Space'
		else if (mainKey === 'ArrowLeft') mainKey = 'Left'
		else if (mainKey === 'ArrowRight') mainKey = 'Right'
		else if (mainKey === 'ArrowUp') mainKey = 'Up'
		else if (mainKey === 'ArrowDown') mainKey = 'Down'
		else if (mainKey.length === 1) mainKey = mainKey.toUpperCase()

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
		try {
			await invoke('update_shortcuts', { configs: items })
			setSaveStatus('快捷键已成功注册并生效')
			setTimeout(() => setSaveStatus(null), 2500)
		} catch (err: any) {
			console.warn('Update shortcuts note:', err)
			setSaveStatus('已保存设置')
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
						点击快捷键输入框即可直接按下按键录制（支持单键如 Space 空格、方向键，或 Alt / Ctrl / Shift 组合键）
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
					<Check className="w-3.5 h-3.5" />
					<span>{saveStatus}</span>
				</div>
			)}

			<div className="space-y-2 rounded-xl bg-white/5 p-3 border border-white/5">
				{shortcuts.map((item) => {
					const isEditing = editingId === item.id
					return (
						<div
							key={item.id}
							className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/5 transition-colors text-xs"
						>
							<div className="flex-1 mr-4">
								<p className="font-medium text-foreground">{item.description}</p>
								<p className="text-[10px] text-muted-foreground font-mono">
									ID: {item.id}
								</p>
							</div>

							<div>
								{isEditing ? (
									<div
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
										className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-foreground text-xs font-mono transition-all duration-150 hover:border-primary/50"
									>
										{item.key || '未设置'}
									</button>
								)}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
