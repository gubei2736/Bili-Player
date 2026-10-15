/**
 * 来源自 packages/shared-core/src/api/bilibili/api.ts
 * Bilibili 分 P 列表接口与音视频流获取接口
 */

import { ResultAsync, okAsync, errAsync } from 'neverthrow'
import type { BilibiliMultipageVideo } from '../../types/bilibili'
import type { BilibiliTrack } from '../../types/media'

export interface BilibiliAudioStreamParams {
	bvid: string
	cid: number
	audioQuality: number
	enableDolby?: boolean
	enableHiRes?: boolean
	preferDolbyFirst?: boolean
}

/**
 * 1. 获取视频分 P 列表接口
 * 官方端点: GET https://api.bilibili.com/x/player/pagelist?bvid={bvid}
 * 返回: 各分 P 的 cid, page, part, duration, first_frame 等
 */
export function getPageListSnippet(
	httpClient: any,
	bvid: string,
	signal?: AbortSignal,
): ResultAsync<BilibiliMultipageVideo[], any> {
	return httpClient.get<BilibiliMultipageVideo[]>({
		endpoint: '/x/player/pagelist',
		params: { bvid },
		signal,
	})
}

/**
 * 2. 获取指定分 P 的音频流接口
 * 官方端点: GET https://api.bilibili.com/x/player/wbi/playurl?bvid={bvid}&cid={cid}&fnval=4048...
 * 注意: 必须携带目标分 P 的具体 cid 才能获取正确的音频流
 */
export function getAudioStreamSnippet(
	httpClient: any,
	getWbiEncodedParams: (params: Record<string, string>) => ResultAsync<Record<string, string>, any>,
	params: BilibiliAudioStreamParams,
): ResultAsync<Exclude<BilibiliTrack['bilibiliMetadata']['bilibiliStreamUrl'], undefined>, any> {
	const { bvid, cid, audioQuality, enableDolby, enableHiRes, preferDolbyFirst } = params
	// 4048 = 16 (DASH) + 64 (HDR) + 128 (4K) + 256 (Dolby) + 512 (8K) + 1024 (AV1) + 2048 (Dolby Vision)
	const fnval = '4048'

	const wbiParams = getWbiEncodedParams({
		bvid,
		cid: String(cid),
		fnval,
		fnver: '0',
		fourk: '1',
		qlt: String(audioQuality),
		voice_balance: '1',
	})

	return wbiParams.andThen((encodedParams) => {
		return httpClient.get<any>({
			endpoint: '/x/player/wbi/playurl',
			params: encodedParams,
		})
	})
}
