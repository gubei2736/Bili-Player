import { parseCookie } from 'cookie'
import { err, ok, type Result } from 'neverthrow'

export interface ICookieProvider {
	getCookie(): Record<string, string> | undefined
	getCookieString(): string
	setCookie?(cookie: Record<string, string>): void
}

export const serializeCookieObject = (
	cookieList?: Record<string, string>,
): string => {
	if (!cookieList) return ''
	return Object.entries(cookieList)
		.map(([key, value]) => `${key}=${value}`)
		.join('; ')
}

export const parseCookieToObject = (
	cookie?: string,
): Result<Record<string, string>, Error> => {
	if (!cookie?.trim()) {
		return ok({})
	}
	try {
		const cookieObj = parseCookie(cookie)
		const sanitizedObj: Record<string, string> = {}
		for (const [key, value] of Object.entries(cookieObj)) {
			if (typeof value === 'string') {
				sanitizedObj[key] = value
			}
		}
		return ok(sanitizedObj)
	} catch (e) {
		return err(e instanceof Error ? e : new Error(String(e)))
	}
}

export class MemoryCookieProvider implements ICookieProvider {
	private cookie: Record<string, string> = {}

	getCookie(): Record<string, string> {
		return this.cookie
	}

	getCookieString(): string {
		return serializeCookieObject(this.cookie)
	}

	setCookie(cookie: Record<string, string>): void {
		this.cookie = cookie
	}
}

let defaultCookieProvider: ICookieProvider = new MemoryCookieProvider()

export function setDefaultCookieProvider(provider: ICookieProvider): void {
	defaultCookieProvider = provider
}

export function getDefaultCookieProvider(): ICookieProvider {
	return defaultCookieProvider
}
