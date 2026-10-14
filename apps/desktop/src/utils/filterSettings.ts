const HIDDEN_FAVORITES_KEY = 'bbplayer_hidden_favorite_ids'
const HIDDEN_COLLECTIONS_KEY = 'bbplayer_hidden_collection_ids'

export function getHiddenFavoriteIds(): number[] {
	if (typeof window === 'undefined') return []
	try {
		const raw = localStorage.getItem(HIDDEN_FAVORITES_KEY)
		return raw ? JSON.parse(raw) : []
	} catch {
		return []
	}
}

export function setHiddenFavoriteIds(ids: number[]): void {
	if (typeof window === 'undefined') return
	localStorage.setItem(HIDDEN_FAVORITES_KEY, JSON.stringify(ids))
	window.dispatchEvent(new CustomEvent('bbplayer:hidden-favorites-change', { detail: ids }))
}

export function toggleHideFavorite(id: number): boolean {
	const current = getHiddenFavoriteIds()
	const exists = current.includes(id)
	const next = exists ? current.filter((x) => x !== id) : [...current, id]
	setHiddenFavoriteIds(next)
	return !exists
}

export function getHiddenCollectionIds(): number[] {
	if (typeof window === 'undefined') return []
	try {
		const raw = localStorage.getItem(HIDDEN_COLLECTIONS_KEY)
		return raw ? JSON.parse(raw) : []
	} catch {
		return []
	}
}

export function setHiddenCollectionIds(ids: number[]): void {
	if (typeof window === 'undefined') return
	localStorage.setItem(HIDDEN_COLLECTIONS_KEY, JSON.stringify(ids))
	window.dispatchEvent(new CustomEvent('bbplayer:hidden-collections-change', { detail: ids }))
}

export function toggleHideCollection(id: number): boolean {
	const current = getHiddenCollectionIds()
	const exists = current.includes(id)
	const next = exists ? current.filter((x) => x !== id) : [...current, id]
	setHiddenCollectionIds(next)
	return !exists
}
