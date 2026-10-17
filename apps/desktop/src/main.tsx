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

// 检查是否为 Debug 构建模式
invoke<boolean>('is_debug_mode')
	.then((isDebug) => {
		if (isDebug) {
			document.body.classList.add('is-debug-mode')
			document.documentElement.classList.add('is-debug-mode')
		} else {
			// 仅在真正的 Release 模式下禁用默认右键菜单
			document.addEventListener('contextmenu', (e) => {
				e.preventDefault()
			})
		}
	})
	.catch(() => {
		if (!(import.meta as any).env?.DEV) {
			document.addEventListener('contextmenu', (e) => {
				e.preventDefault()
			})
		}
	})

window.addEventListener('error', (e) => {
	console.error('[Global Window Error]:', e.error || e.message)
})

window.addEventListener('unhandledrejection', (e) => {
	console.error('[Global Unhandled Rejection]:', e.reason)
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
	document.documentElement.classList.add('is-transparent-window')
	document.documentElement.classList.remove('bg-[#0b0f17]')
	document.documentElement.classList.add('bg-transparent')
	document.documentElement.style.background = 'transparent'
	document.body.classList.add('is-transparent-window')
	document.body.classList.remove('bg-[#0b0f17]')
	document.body.classList.add('bg-transparent')
	document.body.style.background = 'transparent'
	document.body.style.border = 'none'
	document.body.style.outline = 'none'
	const rootEl = document.getElementById('root')
	if (rootEl) {
		rootEl.style.background = 'transparent'
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
