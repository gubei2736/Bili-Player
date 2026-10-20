import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DesktopLyricsApp } from './windows/lyrics/DesktopLyricsApp'
import { setDefaultHttpClient } from '@bbplayer/shared-core'
import { DesktopTauriHttpClient } from './api/desktopHttpClient'
import './styles/globals.css'

import { invoke } from '@tauri-apps/api/core'

// Route all API requests through Rust native HTTP engine (CORS & Set-Cookie safe)
setDefaultHttpClient(new DesktopTauriHttpClient())

import { logError, logDebug } from './utils/debugLogger'

// 全局彻底禁用默认右键上下文菜单（返回、刷新、另存为、打印等），保持桌面播放器原生纯净体验
document.addEventListener('contextmenu', (e) => {
	const target = e.target as HTMLElement | null
	if (
		target &&
		(target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable)
	) {
		return
	}
	e.preventDefault()
}, true)

// 仅在明确的 Debug 构建模式下允许 F12 打开 DevTools
invoke<boolean>('is_debug_mode')
	.then((isDebug) => {
		if (isDebug) {
			window.addEventListener('keydown', (e) => {
				if (e.key === 'F12') {
					invoke('toggle_devtools').catch(() => {})
				}
			})
		}
	})
	.catch(() => {})

window.addEventListener('error', (e) => {
	logError('GlobalWindow', e.message, e.error)
})

window.addEventListener('unhandledrejection', (e) => {
	logError('UnhandledRejection', String(e.reason), e.reason)
})

class GlobalErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
	constructor(props: { children: React.ReactNode }) {
		super(props)
		this.state = { hasError: false, error: null, errorInfo: null }
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('[GlobalErrorBoundary caught]:', error, errorInfo)
		this.setState({ error, errorInfo })
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-8 bg-[#0b0f17] text-white select-text">
					<div className="max-w-xl w-full p-6 rounded-2xl bg-rose-950/40 border border-rose-500/30 backdrop-blur-md shadow-2xl space-y-4">
						<div className="flex items-center gap-3 text-rose-400">
							<span className="text-xl font-bold">⚠️ 界面渲染异常已拦截</span>
						</div>
						<p className="text-xs text-rose-200/80 font-mono bg-black/40 p-3 rounded-lg overflow-auto max-h-40">
							{this.state.error?.toString()}
						</p>
						<button
							onClick={() => window.location.reload()}
							className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors"
						>
							重新加载应用
						</button>
					</div>
				</div>
			)
		}
		return this.props.children
	}
}

import { MiniPlayerApp } from './windows/mini/MiniPlayerApp'
import { TrayMenuApp } from './windows/tray/TrayMenuApp'

const isLyricsWindow = window.location.hash.includes('lyrics')
const isMiniWindow = window.location.hash.includes('mini')
const isTrayWindow = window.location.hash.includes('tray')

if (isLyricsWindow || isMiniWindow || isTrayWindow) {
	document.documentElement.classList.add('is-transparent-window', 'h-full', 'w-full')
	document.documentElement.classList.remove('bg-[#0b0f17]')
	document.documentElement.classList.add('bg-transparent')
	document.documentElement.style.background = 'transparent'
	document.documentElement.style.height = '100%'
	document.documentElement.style.width = '100%'
	document.documentElement.style.overflow = 'hidden'

	document.body.classList.add('is-transparent-window', 'h-full', 'w-full')
	document.body.classList.remove('bg-[#0b0f17]')
	document.body.classList.add('bg-transparent')
	document.body.style.background = 'transparent'
	document.body.style.height = '100%'
	document.body.style.width = '100%'
	document.body.style.margin = '0'
	document.body.style.padding = '0'
	document.body.style.border = 'none'
	document.body.style.outline = 'none'
	document.body.style.overflow = 'hidden'

	const rootEl = document.getElementById('root')
	if (rootEl) {
		rootEl.style.background = 'transparent'
		rootEl.style.height = '100%'
		rootEl.style.width = '100%'
		rootEl.style.overflow = 'hidden'
	}
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<GlobalErrorBoundary>
			{isLyricsWindow ? (
				<DesktopLyricsApp />
			) : isMiniWindow ? (
				<MiniPlayerApp />
			) : isTrayWindow ? (
				<TrayMenuApp />
			) : (
				<App />
			)}
		</GlobalErrorBoundary>
	</React.StrictMode>,
)
