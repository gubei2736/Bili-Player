import type {
	BilibiliGarbBenefitResponse,
	BilibiliGarbSuitDetailResponse,
} from './garb'

/**
 * 获取音频流入参（dash）
 */
export interface BilibiliAudioStreamParams {
	bvid: string
	cid: number
	audioQuality: number
	enableDolby: boolean
	enableHiRes: boolean
}

/**
 * 获取音频流（dash）返回值
 */
export interface BilibiliAudioStreamResponse {
	durl?: [
		{
			order: number // 恒为 1
			url: string
			backup_url: string[]
		},
	]
	dash?: {
		audio:
			| {
					id: number
					baseUrl: string
					backupUrl: string[]
			  }[]
			| null
		dolby?: {
			type: number
			audio:
				| {
						id: number
						baseUrl: string
						backupUrl: string[]
				  }[]
				| null
		} | null
		flac?: {
			display: boolean
			audio: {
				id: number
				baseUrl: string
				backupUrl: string[]
			} | null
		} | null
	}
	volume?: {
		measured_i: number
		target_i: number
		multi_scene_args?: {
			high_dynamic_target_i: string
			normal_target_i: string
			undersized_target_i: string
		}
	}
}

/**
 * 历史记录获得的视频信息
 */
export interface BilibiliHistoryVideo {
	aid: number
	bvid: string
	title: string
	pic: string
	pubdate: number
	owner: {
		name: string
		mid: number
		face: string
	}
	duration: number
}

/**
 * 通过details接口获取的视频完整信息
 */
export interface BilibiliVideoDetails {
	aid: number
	bvid: string
	title: string
	pic: string
	pubdate: number
	duration: number
	desc: string
	owner: {
		name: string
		mid: number
		face: string
	}
	cid: number
	pages: BilibiliVideoDetailsPage[]
}

/**
 * bilibili 视频详情接口获取到的 pages 字段
 */
export interface BilibiliVideoDetailsPage {
	part: string
	duration: number
	cid: number
}

/**
 * 收藏夹信息
 */
export interface BilibiliPlaylist {
	id: number
	title: string
	media_count: number
	fav_state: number // 目标 id 是否存在于收藏夹中：0：不存在；1：存在
}

/**
 * 搜索结果视频信息
 */
export interface BilibiliSearchVideo {
	type: string // 视频为 video；search_type=video 时也可能返回 ketang
	aid: number
	bvid: string
	title: string
	pic: string
	author: string
	duration: string // MM:SS
	senddate: number
	mid: number
	typeid: number
}

/**
 * 搜索结果UP主信息
 */
export interface BilibiliSearchUser {
	type: 'bili_user'
	mid: number
	uname: string
	usign: string
	fans: number
	videos: number
	upic: string
	verify_info?: string
	level: number
	gender?: number
	is_upuser?: number
	is_live?: number
	room_id?: number
}

/**
 * 热门搜索信息
 */
export interface BilibiliHotSearch {
	keyword: string
	show_name: string
}

/**
 * 用户详细信息
 */
export interface BilibiliUserInfo {
	mid: number
	name: string
	face: string
	sign: string
}

/**
 * 收藏夹内容项
 */
export interface BilibiliFavoriteListContent {
	id: number
	bvid: string
	upper: {
		mid: number
		name: string
		face: string
	}
	title: string
	cover: string
	duration: number
	pubdate: number
	page: number // 分P数量
	type: number // 2：视频稿件 12：音频 21：视频合集
	attr: number // 失效 0: 正常；9: up自己删除；1: 其他原因删除
}

/**
 * 收藏夹内容列表
 */
export interface BilibiliFavoriteListContents {
	info: {
		id: number
		title: string
		cover: string
		media_count: number
		intro: string
		upper: {
			name: string
			face: string
			mid: number
		}
	} | null
	medias: BilibiliFavoriteListContent[] | null
	has_more: boolean
	ttl: number
}

/**
 * 收藏夹所有内容（仅ID）
 */
export type BilibiliFavoriteListAllContents = {
	id: number
	bvid: string
	type: number
}[]

/**
 * 追更合集/收藏夹列表中的单项数据
 */
export interface BilibiliCollection {
	id: number
	title: string
	cover: string
	upper: {
		mid: number
		name: string
	}
	media_count: number
	ctime: number
	intro: string
	attr: number
	state: 0 | 1
}

export interface BilibiliCollectionContent {
	info: {
		id: number
		season_type: number
		title: string
		cover: string
		media_count: number
		intro: string
		upper: {
			name: string
			mid: number
		}
	}
	medias: {
		id: number
		bvid: string
		title: string
		cover: string
		intro: string
		duration: number
		pubtime: number
		upper: {
			mid: number
			name: string
		}
	}
}

export interface BilibiliCollectionInfo {
	id: number
	season_type: number
	title: string
	cover: string
	upper: {
		mid: number
		name: string
	}
	cnt_info: {
		collect: number
		play: number
		danmaku: number
	}
	media_count: number
	intro: string
}

export interface BilibiliMediaItemInCollection {
	id: number
	title: string
	cover: string
	duration: number
	pubtime: number
	bvid: string
	upper: {
		mid: number
		name: string
	}
	cnt_info: {
		collect: number
		play: number
		danmaku: number
	}
}

export interface BilibiliCollectionAllContents {
	info: BilibiliCollectionInfo
	medias: BilibiliMediaItemInCollection[] | null
}

export interface BilibiliSeriesMetadata {
	meta: {
		series_id: number
		mid: number
		name: string
		description: string
		total: number
	}
}

export interface BilibiliSeriesArchives {
	page: { num: number; size: number; total: number }
	archives:
		| {
				aid: number
				bvid: string
				title: string
				pic: string
				duration: number
				pubdate: number
				upMid: number
		  }[]
		| null
}

export interface BilibiliMultipageVideo {
	cid: number
	page: number
	part: string
	duration: number
	first_frame: string
}

export interface BilibiliDealFavoriteForOneVideoResponse {
	prompt: boolean
	ga_data: unknown
	toast_msg: string
	success_num: number
}

export interface BilibiliUserUploadedVideosResponse {
	page: {
		pn: number
		ps: number
		count: number
	}
	list: {
		vlist: {
			aid: number
			bvid: string
			title: string
			pic: string
			created: number
			length: string
			author: string
		}[]
	}
}

export enum BilibiliQrCodeLoginStatus {
	QRCODE_LOGIN_STATUS_WAIT = 86101, // 等待扫码
	QRCODE_LOGIN_STATUS_SCANNED_BUT_NOT_CONFIRMED = 86090, // 扫码但未确认
	QRCODE_LOGIN_STATUS_SUCCESS = 0, // 扫码成功
	QRCODE_LOGIN_STATUS_QRCODE_EXPIRED = 86038, // 二维码已过期
}

export interface BilibiliCaptchaTokenData {
	token: string
	geetest: {
		gt: string
		challenge: string
	}
	tencent: {
		appid: string
	}
}

export interface BilibiliSmsSendData {
	captcha_key: string
}

export interface BilibiliSmsLoginData {
	status: number
	message: string
	url: string
	mid: number
	access_token: string
	refresh_token: string
	expires_in: number
	token_info: {
		mid: number
		access_token: string
		refresh_token: string
		expires_in: number
	} | null
}

export interface BilibiliSearchSuggestionItem {
	term: string
	value: string
	ref: number
	name: string
	spid: number
	type: string
}

export interface BilibiliWebPlayerInfo {
	view_points?: { type?: number; from: number; to: number; content: string }[]
	bgm_info?: {
		music_id: number
		music_title: string
		jump_url: string
	}
}

export interface BilibiliToViewVideoList {
	count: number
	list: {
		aid: number
		bvid: string
		count: number
		pubdate: number
		owner: {
			mid: number
			name: string
			face: string
		}
		cid: number
		title: string
		duration: number
		pic: string
		progress: number
	}[]
}

export interface BilibiliCommentMember {
	mid: string
	uname: string
	sex: string
	sign: string
	avatar: string
	rank: string
	level_info: {
		current_level: number
	}
}

export interface BilibiliCommentEmote {
	id: number
	package_id: number
	state: number
	type: number
	attr: number
	text: string
	url: string
	meta?: {
		size?: number
	}
	mtime: number
	jump_title?: string
}

export interface BilibiliCommentContent {
	message: string
	plat: number
	device: string
	members: unknown[]
	emote?: Record<string, BilibiliCommentEmote>
	jump_url: Record<string, unknown>
	max_line: number
	pictures?: {
		img_src: string
		img_width: number
		img_height: number
		img_size: number
	}[]
}

export interface BilibiliCommentItem {
	rpid: number
	oid: number
	type: number
	mid: number
	root: number
	parent: number
	dialog: number
	count: number
	rcount: number
	state: number
	fansgrade: number
	attr: number
	ctime: number
	rpid_str: string
	root_str: string
	parent_str: string
	like: number
	action: number
	member: BilibiliCommentMember
	content: BilibiliCommentContent
	replies: BilibiliCommentItem[] | null
	assist: number
	folder: {
		has_folded: boolean
		is_folded: boolean
		rule: string
	}
	invisible: boolean
}

export interface BilibiliCommentsResponse {
	cursor: {
		is_begin: boolean
		prev: number
		next: number
		is_end: boolean
		mode: number
		show_header: number
		all_count: number
		support_mode: number[]
		name: string
	}
	replies: BilibiliCommentItem[] | null
	top: {
		upper: BilibiliCommentItem | null
		admin: BilibiliCommentItem | null
	}
}

export interface BilibiliReplyCommentsResponse {
	page: {
		num: number
		size: number
		count: number
	}
	replies: BilibiliCommentItem[] | null
	root: BilibiliCommentItem
}

export interface BilibiliGarbSearchItem {
	item_id: number
	name: string
	part_id: number
	properties: {
		dlc_act_id?: string
		dlc_lottery_id?: string
		image_cover?: string
		image_cover_long?: string
		fan_share_image?: string
	}
}

export interface BilibiliGarbSearchResponse {
	list: BilibiliGarbSearchItem[] | null
	pn: number
	ps: number
	total: number
}

export interface BilibiliGarbAssetBagItem {
	item_type: number
	card_item?: {
		card_type_id?: number | string
		card_name?: string
		card_img?: string
		card_type?: number
		video_list?: string[] | null
		card_scarcity?: number
	}
}

export interface BilibiliGarbCollectEntry {
	redeem_item_type: number
	redeem_item_id: string
	redeem_item_name: string
	redeem_item_image?: string
	require_item_amount?: number
	card_item?: {
		card_asset_info?: {
			card_item?: {
				card_type_id?: number | string
				card_name?: string
				card_img?: string
				card_type?: number
				video_list?: string[] | null
			}
		}
	}
}

export interface BilibiliGarbAssetBagResponse {
	item_list?: BilibiliGarbAssetBagItem[]
	collect_list?: BilibiliGarbCollectEntry[]
}

export interface BilibiliUserRelation {
	mid: number
	attribute: number
}

export interface BilibiliFollowingProfile {
	mid: number
	uname: string
	face: string
	sign: string
}

export interface BilibiliFollowing
	extends BilibiliUserRelation, BilibiliFollowingProfile {}

export interface BilibiliFollowingsResponse {
	list: BilibiliFollowing[] | null
	total: number
}

export interface BilibiliFollowingGroup {
	tagid: number
	name: string
	count: number
}

export type {
	BilibiliGarbBenefitResponse,
	BilibiliGarbSuitDetailResponse,
}
