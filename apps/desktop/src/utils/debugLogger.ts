import { invoke } from '@tauri-apps/api/core'

let isDebugMode = true

if (typeof window !== 'undefined') {
	;(window as any).__APP_DEBUG_LOGS__ = (window as any).__APP_DEBUG_LOGS__ || []
	invoke<boolean>('is_debug_mode')
		.then((debug) => {
			isDebugMode = debug
			;(window as any).__IS_DEBUG_MODE__ = debug
		})
		.catch(() => {
			isDebugMode = true
		})
}

function formatLogLine(module: string, message: string, data?: any): string {
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
			if (data instanceof Error) {
				dataStr = `Error(${data.name}: ${data.message}\n${data.stack || ''})`
			} else {
				dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data)
			}
		} catch {
			dataStr = '[Circular/Unserializable]'
		}
	}

	return `[${timeStr}] [${module}] ${message} ${dataStr}`.trim()
}

/**
 * 核心调试输出器：在 Debug 模式下输出到控制台、内存环形缓冲区并持久化写入本地磁盘日志
 */
export function logDebug(module: string, message: string, data?: any): void {
	if (!isDebugMode) return

	const logLine = formatLogLine(module, message, data)
	console.log(`%c[${module}]`, 'color: #00AEEC; font-weight: bold', message, data ?? '')

	if (typeof window !== 'undefined') {
		const buf = (window as any).__APP_DEBUG_LOGS__
		if (buf) {
			buf.push(logLine)
			if (buf.length > 500) buf.shift()
		}
	}

	invoke('append_debug_log', { message: logLine }).catch(() => {})
}

/**
 * 错误调试输出器：输出红色高亮错误并在界面触发全局错误事件
 */
export function logError(module: string, message: string, error?: any): void {
	if (!isDebugMode) return

	const logLine = formatLogLine(module, `❌ ERROR: ${message}`, error)
	console.error(`%c[${module} ERROR]`, 'color: #F43F5E; font-weight: bold', message, error ?? '')

	if (typeof window !== 'undefined') {
		const buf = (window as any).__APP_DEBUG_LOGS__
		if (buf) {
			buf.push(logLine)
			if (buf.length > 500) buf.shift()
		}
		window.dispatchEvent(
			new CustomEvent('bbplayer:debug-error', {
				detail: { module, message, error: String(error?.message || error || '') },
			}),
		)
	}

	invoke('append_debug_log', { message: logLine }).catch(() => {})
}

/**
 * 兼容旧代码的 logMultipart 接口
 */
export function logMultipart(module: string, message: string, data?: any): void {
	logDebug(module, message, data)
}

/**
 * 获取当前内存中暂存的最近 500 条日志
 */
export function getDebugLogs(): string[] {
	if (typeof window === 'undefined') return []
	return (window as any).__APP_DEBUG_LOGS__ || []
}

/**
 * 打开本地日志文件（Notepad）
 */
export async function openDebugLogFile(): Promise<void> {
	await invoke('open_debug_log_file').catch(() => {})
}

/**
 * 切换 DevTools 开发者工具
 */
export async function toggleDevTools(): Promise<void> {
	await invoke('toggle_devtools').catch(() => {})
}
