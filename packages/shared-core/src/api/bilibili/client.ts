import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import {
	getDefaultCookieProvider,
	type ICookieProvider,
	serializeCookieObject,
} from '../cookie'
import {
	getDefaultHttpClient,
	type HttpRequestOptions,
	type IHttpClient,
} from '../http'
import { BilibiliApiError } from './errors'
import { getCsrfToken } from './utils'

export interface ReqResponse<T> {
	code: number
	message: string
	data: T
}

const toRequestError = (error: unknown): BilibiliApiError => {
	if (error instanceof Error && error.name === 'AbortError') {
		return new BilibiliApiError({
			message: '请求被取消',
			type: 'RequestAborted',
			cause: error,
		})
	}

	return new BilibiliApiError({
		message: `请求失败: ${error instanceof Error ? error.message : String(error)}`,
		type: 'RequestFailed',
		cause: error,
	})
}

export class BilibiliApiClient {
	private readonly baseUrl = 'https://api.bilibili.com'

	constructor(
		private readonly httpClient?: IHttpClient,
		private readonly cookieProvider?: ICookieProvider,
	) {}

	private get http(): IHttpClient {
		return this.httpClient ?? getDefaultHttpClient()
	}

	private get cookie(): ICookieProvider {
		return this.cookieProvider ?? getDefaultCookieProvider()
	}

	private request = <T>({
		endpoint,
		options = {},
		fullUrl,
		skipCookie,
	}: {
		endpoint: string
		options?: HttpRequestOptions
		fullUrl?: string
		skipCookie?: boolean
	}): ResultAsync<T, BilibiliApiError> => {
		const url = fullUrl ?? `${this.baseUrl}${endpoint}`
		const cookieList = this.cookie.getCookie()
		const cookieHeader =
			cookieList && !skipCookie ? serializeCookieObject(cookieList) : ''

		const defaultHeaders: Record<string, string> = {
			Cookie: cookieHeader,
			'User-Agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0',
			Referer: 'https://www.bilibili.com/',
			Origin: 'https://www.bilibili.com',
		}

		const mergedHeaders: Record<string, string> = {
			...defaultHeaders,
			...(options.headers ?? {}),
		}

		return ResultAsync.fromPromise(
			this.http.fetch(url, {
				...options,
				headers: mergedHeaders,
				credentials: 'omit',
			}),
			toRequestError,
		)
			.andThen((response) => {
				if (!response.ok) {
					return errAsync(
						new BilibiliApiError({
							message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
							msgCode: response.status,
							type: 'RequestFailed',
						}),
					)
				}
				const dataPromise = response.json() as Promise<ReqResponse<T>>
				return ResultAsync.fromPromise(
					dataPromise,
					(error) =>
						new BilibiliApiError({
							message: error instanceof Error ? error.message : String(error),
							type: 'ResponseFailed',
						}),
				)
			})
			.andThen((data) => {
				// 对于 wbi 接口，直接返回 data，因为未登录状态下 code 为 -101
				if (endpoint === '/x/web-interface/nav') {
					return okAsync(data.data)
				}
				if (data.code !== 0) {
					return errAsync(
						new BilibiliApiError({
							message: data.message,
							msgCode: data.code,
							rawData: data.data,
							type: 'ResponseFailed',
						}),
					)
				}
				return okAsync(data.data)
			})
	}

	get<T>({
		endpoint,
		params,
		fullUrl,
		skipCookie,
		signal,
	}: {
		endpoint: string
		params?: Record<string, string | undefined> | string
		fullUrl?: string
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<T, BilibiliApiError> {
		let url = endpoint
		if (typeof params === 'string') {
			url = `${endpoint}?${params}`
		} else if (params) {
			const searchParams = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					searchParams.append(key, value)
				}
			}
			url = `${endpoint}?${searchParams.toString()}`
		}
		return this.request<T>({
			endpoint: url,
			options: { method: 'GET', signal },
			fullUrl,
			skipCookie,
		})
	}

	getBuffer({
		endpoint,
		params,
		headers,
		fullUrl,
		skipCookie,
		signal,
	}: {
		endpoint: string
		params?: Record<string, string | undefined> | string
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<ArrayBuffer, BilibiliApiError> {
		let url = endpoint
		if (typeof params === 'string') {
			url = `${endpoint}?${params}`
		} else if (params) {
			const searchParams = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					searchParams.append(key, value)
				}
			}
			url = `${endpoint}?${searchParams.toString()}`
		}
		const requestUrl = fullUrl ?? `${this.baseUrl}${url}`
		const cookieList = this.cookie.getCookie()
		const cookieHeader =
			cookieList && !skipCookie ? serializeCookieObject(cookieList) : ''

		const requestHeaders: Record<string, string> = {
			Cookie: cookieHeader,
			'User-Agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0',
			Referer: 'https://www.bilibili.com/',
			Origin: 'https://www.bilibili.com',
			...headers,
		}

		return ResultAsync.fromPromise(
			this.http.fetch(requestUrl, {
				method: 'GET',
				headers: requestHeaders,
				signal,
				credentials: 'omit',
			}),
			toRequestError,
		).andThen((response) => {
			if (!response.ok) {
				return errAsync(
					new BilibiliApiError({
						message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
						msgCode: response.status,
						type: 'RequestFailed',
					}),
				)
			}
			return ResultAsync.fromPromise(
				response.arrayBuffer(),
				(error) =>
					new BilibiliApiError({
						message: error instanceof Error ? error.message : String(error),
						type: 'ResponseFailed',
					}),
			)
		})
	}

	post<T>({
		endpoint,
		data,
		headers,
		fullUrl,
		skipCookie,
	}: {
		endpoint: string
		data?: any
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
	}): ResultAsync<T, BilibiliApiError> {
		return this.request<T>({
			endpoint,
			options: {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					...headers,
				},
				body: data,
			},
			fullUrl,
			skipCookie,
		})
	}

	postWithCsrf<T>({
		endpoint,
		payload = {},
	}: {
		endpoint: string
		payload?: Record<string, string>
	}): ResultAsync<T, BilibiliApiError> {
		return getCsrfToken(this.cookie.getCookie()).asyncAndThen((csrfToken) => {
			const dataWithCsrf = {
				...payload,
				csrf: csrfToken,
			}
			const body = new URLSearchParams(dataWithCsrf).toString()
			return this.post<T>({ endpoint, data: body })
		})
	}
}

export const bilibiliApiClient = new BilibiliApiClient()
