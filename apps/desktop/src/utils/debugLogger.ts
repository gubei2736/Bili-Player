import { invoke } from '@tauri-apps/api/core'

/**
 * 专用分 P 状态全链路追踪日志工具
 * 仅在开发/Debug 模式下输出控制台与落盘追踪日志，Release 生产包彻底禁用
 */
export function logMultipart(module: string, message: string, data?: any): void {
	if (import.meta.env.PROD) {
		return
	}
	const now = new Date()
	const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
		.getMinutes()
		.toString()
		.padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
		.getMilliseconds()
		.toString()
		.padStart(3, '0')}`

	let dataStr = ''
	if (data !== undefined) {
		try {
			dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data)
		} catch {
			dataStr = '[Circular/Unserializable]'
		}
	}

	const logLine = `[${timeStr}] [${module}] ${message} ${dataStr}`.trim()
	console.log(`%c[${module}]`, 'color: #00AEEC; font-weight: bold', message, data ?? '')

	invoke('append_debug_log', { message: logLine }).catch(() => {})
}
