import type { IHttpClient, HttpRequestOptions, HttpResponse } from '@bbplayer/shared-core'
import { invoke } from '@tauri-apps/api/core'
import { logDebug, logError } from '../utils/debugLogger'

interface NativeHttpResponse {
	ok: boolean
	status: number
	status_text: string
	headers: Record<string, string>
	body: string
}

export class DesktopTauriHttpClient implements IHttpClient {
	async fetch(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
		let bodyStr: string | undefined = undefined
		if (options.body) {
			bodyStr =
				typeof options.body === 'string'
					? options.body
					: JSON.stringify(options.body)
		}

		const executeNative = async (attempt: number): Promise<NativeHttpResponse> => {
			try {
				return await invoke<NativeHttpResponse>('native_http_request', {
					request: {
						url,
						method: options.method || 'GET',
						headers: options.headers || {},
						body: bodyStr,
					},
				})
			} catch (err: any) {
				if (attempt < 2) {
					logDebug('DesktopHttpClient', `Native HTTP 请求首发异常，将在 300ms 后自动重试 (1/2): ${err?.message || err}`)
					await new Promise((r) => setTimeout(r, 300))
					return await invoke<NativeHttpResponse>('native_http_request', {
						request: {
							url,
							method: options.method || 'GET',
							headers: options.headers || {},
							body: bodyStr,
						},
					})
				}
				throw err
			}
		}

		try {
			const res = await executeNative(1)

			const headerMap = new Map<string, string>()
			for (const [key, val] of Object.entries(res.headers)) {
				headerMap.set(key.toLowerCase(), val)
			}
			const headers = {
				get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
				has: (name: string) => headerMap.has(name.toLowerCase()),
				entries: () => headerMap.entries(),
				forEach: (callback: any) => headerMap.forEach(callback),
			} as unknown as Headers

			return {
				ok: res.ok,
				status: res.status,
				statusText: res.status_text,
				headers,
				json: async () => JSON.parse(res.body),
				text: async () => res.body,
				arrayBuffer: async () => new TextEncoder().encode(res.body).buffer,
			}
		} catch (err: any) {
			logError('DesktopHttpClient', `Native HTTP 请求彻底失败 [${url.substring(0, 100)}]`, err)
			throw new Error(`Native HTTP 请求失败: ${err?.message || err}`)
		}
	}
}
