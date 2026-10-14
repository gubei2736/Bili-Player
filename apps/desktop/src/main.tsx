import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DesktopLyricsApp } from './windows/lyrics/DesktopLyricsApp'
import './styles/globals.css'

const isLyricsWindow = window.location.hash.includes('lyrics')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		{isLyricsWindow ? <DesktopLyricsApp /> : <App />}
	</React.StrictMode>,
)
