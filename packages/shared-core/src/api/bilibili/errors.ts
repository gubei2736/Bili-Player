export type BilibiliApiErrorType =
	| 'RequestFailed'
	| 'ResponseFailed'
	| 'NoCookie'
	| 'CsrfError'
	| 'AudioStreamError'
	| 'RequestAborted'
	| 'InvalidArgument'

export interface BilibiliApiErrorDetails {
	message: string
	msgCode?: number
	rawData?: unknown
	type?: BilibiliApiErrorType
	cause?: unknown
}

export interface BilibiliErrorData {
	msgCode: number
	rawData: unknown
}

export class BilibiliApiError extends Error {
	readonly data: BilibiliErrorData
	readonly type?: BilibiliApiErrorType
	readonly vendor = 'Bilibili'

	constructor({
		message,
		msgCode,
		rawData,
		type,
		cause,
	}: BilibiliApiErrorDetails) {
		super(message, { cause })
		this.name = 'BilibiliApiError'
		this.data = {
			rawData,
			msgCode: msgCode ?? 0,
		}
		this.type = type
	}
}
