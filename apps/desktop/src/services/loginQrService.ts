import QRCode from 'qrcode'
import { bilibiliApi } from '@bbplayer/shared-core'

export interface CachedQrData {
	url: string
	qrcodeKey: string
	dataUrl: string
	timestamp: number
}

let cachedQr: CachedQrData | null = null
let prefetchPromise: Promise<CachedQrData | null> | null = null

export const loginQrService = {
	getValidCached(): CachedQrData | null {
		if (cachedQr && Date.now() - cachedQr.timestamp < 120_000) {
			return cachedQr
		}
		return null
	},

	clearCache() {
		cachedQr = null
		prefetchPromise = null
	},

	async fetchNewQrCode(): Promise<CachedQrData | null> {
		if (prefetchPromise) return prefetchPromise

		prefetchPromise = (async () => {
			try {
				const result = await bilibiliApi.getLoginQrCode()
				if (result.isOk() && result.value.qrcode_key && result.value.url) {
					let dataUrl = ''
					try {
						dataUrl = await QRCode.toDataURL(result.value.url, {
							margin: 1,
							width: 200,
							color: {
								dark: '#000000',
								light: '#ffffff',
							},
						})
					} catch {
						dataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
							result.value.url,
						)}`
					}

					const data: CachedQrData = {
						url: result.value.url,
						qrcodeKey: result.value.qrcode_key,
						dataUrl,
						timestamp: Date.now(),
					}
					cachedQr = data
					return data
				}
				return null
			} catch (e) {
				console.warn('QR code prefetch error:', e)
				return null
			} finally {
				prefetchPromise = null
			}
		})()

		return prefetchPromise
	},

	async getOrFetch(): Promise<CachedQrData | null> {
		const cached = this.getValidCached()
		if (cached) return cached
		return this.fetchNewQrCode()
	},
}
