import type {
	BilibiliFavoriteListContent,
	BilibiliMediaItemInCollection,
	BilibiliTrack,
} from '@bbplayer/shared-core'

export function formatDuration(seconds: number): string {
	if (!seconds || isNaN(seconds)) return '00:00'
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatCoverUrl(url: string | undefined): string {
	if (!url) return 'https://i0.hdslb.com/bfs/archive/placeholder.jpg'
	if (url.startsWith('//')) return 'https:' + url
	return url
}

export function convertFavoriteItemToTrack(
	item: BilibiliFavoriteListContent,
	index: number,
): BilibiliTrack {
	return {
		id: item.id || index + 1,
		uniqueKey: `bilibili_${item.bvid}_0`,
		title: item.title,
		artist: {
			id: item.upper?.mid || index + 1,
			name: item.upper?.name || '未知UP主',
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		coverUrl: formatCoverUrl(item.cover),
		duration: item.duration || 180,
		source: 'bilibili',
		createdAt: new Date(item.pubdate ? item.pubdate * 1000 : Date.now()),
		updatedAt: new Date(),
		bilibiliMetadata: {
			bvid: item.bvid,
			cid: null,
			isMultiPage: (item.page || 1) > 1,
			videoIsValid: item.attr === 0,
		},
	}
}

export function convertCollectionMediaToTrack(
	item: BilibiliMediaItemInCollection,
	index: number,
): BilibiliTrack {
	return {
		id: item.id || index + 1,
		uniqueKey: `bilibili_${item.bvid}_0`,
		title: item.title,
		artist: {
			id: item.upper?.mid || index + 1,
			name: item.upper?.name || '未知UP主',
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		coverUrl: formatCoverUrl(item.cover),
		duration: item.duration || 180,
		source: 'bilibili',
		createdAt: new Date(item.pubtime ? item.pubtime * 1000 : Date.now()),
		updatedAt: new Date(),
		bilibiliMetadata: {
			bvid: item.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}
