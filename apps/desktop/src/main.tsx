import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DesktopLyricsApp } from './windows/lyrics/DesktopLyricsApp'
import './styles/globals.css'

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
