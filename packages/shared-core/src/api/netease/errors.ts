export type NeteaseApiErrorType =
	| 'RequestFailed'
	| 'ResponseFailed'
	| 'SearchResultNoMatch'

export interface NeteaseApiErrorDetails {
	message: string
	msgCode?: number
	rawData?: unknown
	type?: NeteaseApiErrorType
	cause?: unknown
}

export interface NeteaseErrorData {
	msgCode: number
	rawData: unknown
}

export class NeteaseApiError extends Error {
	readonly data: NeteaseErrorData
	readonly type?: NeteaseApiErrorType
	readonly vendor = 'Netease'

	constructor({
		message,
		msgCode,
		rawData,
		type,
		cause,
	}: NeteaseApiErrorDetails) {
		super(message, { cause })
		this.name = 'NeteaseApiError'
		this.data = {
			rawData,
			msgCode: msgCode ?? 0,
		}
		this.type = type
	}
}
