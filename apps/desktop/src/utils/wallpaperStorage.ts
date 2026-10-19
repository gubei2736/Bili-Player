// IndexedDB utility for high-capacity wallpaper storage (supporting high-res images and large video wallpapers)
const DB_NAME = 'bbplayer_wallpaper_db'
const DB_VERSION = 1
const STORE_NAME = 'wallpapers'
const KEY_CURRENT = 'current_wallpaper'

export interface WallpaperRecord {
	id: string
	blob: Blob
	mimeType: string
	type: 'image' | 'video'
	updatedAt: number
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' })
			}
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

let activeWallpaperObjectUrl: string | null = null

export async function saveWallpaperToDb(
	file: Blob,
	type: 'image' | 'video',
): Promise<string> {
	const db = await openDB()
	const record: WallpaperRecord = {
		id: KEY_CURRENT,
		blob: file,
		mimeType: file.type,
		type,
		updatedAt: Date.now(),
	}

	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		const store = tx.objectStore(STORE_NAME)
		const req = store.put(record)
		req.onsuccess = () => resolve()
		req.onerror = () => reject(req.error)
	})

	if (activeWallpaperObjectUrl) {
		try {
			URL.revokeObjectURL(activeWallpaperObjectUrl)
		} catch {}
	}
	activeWallpaperObjectUrl = URL.createObjectURL(file)
	return activeWallpaperObjectUrl
}

export async function getWallpaperFromDb(): Promise<{
	url: string
	type: 'image' | 'video'
} | null> {
	try {
		const db = await openDB()
		const record = await new Promise<WallpaperRecord | null>(
			(resolve, reject) => {
				const tx = db.transaction(STORE_NAME, 'readonly')
				const store = tx.objectStore(STORE_NAME)
				const req = store.get(KEY_CURRENT)
				req.onsuccess = () => resolve(req.result || null)
				req.onerror = () => reject(req.error)
			},
		)

		if (record && record.blob) {
			if (activeWallpaperObjectUrl) {
				try {
					URL.revokeObjectURL(activeWallpaperObjectUrl)
				} catch {}
			}
			activeWallpaperObjectUrl = URL.createObjectURL(record.blob)
			return { url: activeWallpaperObjectUrl, type: record.type }
		}
		return null
	} catch (e) {
		console.warn('Failed to get wallpaper from IndexedDB:', e)
		return null
	}
}

export async function clearWallpaperFromDb(): Promise<void> {
	try {
		const db = await openDB()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			const req = store.delete(KEY_CURRENT)
			req.onsuccess = () => resolve()
			req.onerror = () => reject(req.error)
		})
	} catch (e) {
		console.warn('Failed to clear wallpaper from IndexedDB:', e)
	}

	if (activeWallpaperObjectUrl) {
		try {
			URL.revokeObjectURL(activeWallpaperObjectUrl)
		} catch {}
		activeWallpaperObjectUrl = null
	}
}
