import type { IHttpClient, HttpRequestOptions, HttpResponse } from '@bbplayer/shared-core'
import { invoke } from '@tauri-apps/api/core'

interface NativeHttpResponse {
	ok: boolean
	status: number
	status_text: string
	headers: Record<string, string>
	body: string
}

export class DesktopTauriHttpClient implements IHttpClient {
	async fetch(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
		try {
			let bodyStr: string | undefined = undefined
			if (options.body) {
				bodyStr =
					typeof options.body === 'string'
						? options.body
						: JSON.stringify(options.body)
			}

			const res = await invoke<NativeHttpResponse>('native_http_request', {
				request: {
					url,
					method: options.method || 'GET',
					headers: options.headers || {},
					body: bodyStr,
				},
			})

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
		} catch (err) {
			console.warn('Native HTTP request fallback to global fetch:', err)
			const fallbackRes = await fetch(url, {
				method: options.method || 'GET',
				headers: options.headers,
				body: options.body,
				signal: options.signal,
			})
			return {
				ok: fallbackRes.ok,
				status: fallbackRes.status,
				statusText: fallbackRes.statusText,
				headers: fallbackRes.headers,
				json: () => fallbackRes.json(),
				text: () => fallbackRes.text(),
				arrayBuffer: () => fallbackRes.arrayBuffer(),
			}
		}
	}
}
