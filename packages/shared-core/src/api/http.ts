export interface HttpRequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'
	headers?: Record<string, string>
	body?: any
	signal?: AbortSignal
	credentials?: 'omit' | 'same-origin' | 'include'
}

export interface HttpResponse<T = any> {
	ok: boolean
	status: number
	statusText: string
	headers: Headers
	json: () => Promise<T>
	text: () => Promise<string>
	arrayBuffer: () => Promise<ArrayBuffer>
}

export type FetchFunction = (
	input: RequestInfo | URL | string,
	init?: RequestInit,
) => Promise<Response>

export interface IHttpClient {
	fetch(url: string, options?: HttpRequestOptions): Promise<HttpResponse>
}

export class DefaultHttpClient implements IHttpClient {
	constructor(private readonly customFetch?: FetchFunction) {}

	private get fetchFn(): FetchFunction {
		if (this.customFetch) return this.customFetch
		if (typeof globalThis.fetch === 'function') {
			return globalThis.fetch.bind(globalThis)
		}
		throw new Error(
			'No fetch implementation found. Please inject a custom FetchFunction into DefaultHttpClient.',
		)
	}

	async fetch(
		url: string,
		options: HttpRequestOptions = {},
	): Promise<HttpResponse> {
		const res = await this.fetchFn(url, {
			method: options.method ?? 'GET',
			headers: options.headers,
			body: options.body,
			signal: options.signal,
			credentials: options.credentials,
		})

		return {
			ok: res.ok,
			status: res.status,
			statusText: res.statusText,
			headers: res.headers,
			json: () => res.json(),
			text: () => res.text(),
			arrayBuffer: () => res.arrayBuffer(),
		}
	}
}

let defaultHttpClient: IHttpClient = new DefaultHttpClient()

export function setDefaultHttpClient(client: IHttpClient): void {
	defaultHttpClient = client
}

export function getDefaultHttpClient(): IHttpClient {
	return defaultHttpClient
}
