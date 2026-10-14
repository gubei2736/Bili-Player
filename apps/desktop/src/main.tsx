import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DesktopLyricsApp } from './windows/lyrics/DesktopLyricsApp'
import { setDefaultHttpClient } from '@bbplayer/shared-core'
import { DesktopTauriHttpClient } from './api/desktopHttpClient'
import './styles/globals.css'

// Route all API requests through Rust native HTTP engine (CORS & Set-Cookie safe)
setDefaultHttpClient(new DesktopTauriHttpClient())

// 彻底禁用系统/WebView2 默认的浏览器上下文菜单（返回、刷新、另存为、检查等）
document.addEventListener('contextmenu', (e) => {
	e.preventDefault()
})

const isLyricsWindow = window.location.hash.includes('lyrics')
if (isLyricsWindow) {
	document.body.classList.remove('bg-[#0b0f17]')
	document.body.classList.add('bg-transparent')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		{isLyricsWindow ? <DesktopLyricsApp /> : <App />}
	</React.StrictMode>,
)
