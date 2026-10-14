import { eq, desc, and } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

import * as schema from './schema'

export type DatabaseInstance = BaseSQLiteDatabase<any, any, typeof schema>

export class DatabaseQueries {
	constructor(private readonly db: DatabaseInstance) {}

	async getTrackByUniqueKey(uniqueKey: string) {
		const result = await this.db
			.select()
			.from(schema.tracks)
			.where(eq(schema.tracks.uniqueKey, uniqueKey))
			.limit(1)

		return result[0] ?? null
	}

	async getTrackDetails(trackId: number) {
		const track = await this.db
			.select()
			.from(schema.tracks)
			.where(eq(schema.tracks.id, trackId))
			.limit(1)

		if (!track[0]) return null

		const [artist, biliMeta, localMeta] = await Promise.all([
			track[0].artistId
				? this.db
						.select()
						.from(schema.artists)
						.where(eq(schema.artists.id, track[0].artistId))
						.limit(1)
						.then((r) => r[0] ?? null)
				: Promise.resolve(null),
			this.db
				.select()
				.from(schema.bilibiliMetadata)
				.where(eq(schema.bilibiliMetadata.trackId, trackId))
				.limit(1)
				.then((r) => r[0] ?? null),
			this.db
				.select()
				.from(schema.localMetadata)
				.where(eq(schema.localMetadata.trackId, trackId))
				.limit(1)
				.then((r) => r[0] ?? null),
		])

		return {
			...track[0],
			artist,
			bilibiliMetadata: biliMeta,
			localMetadata: localMeta,
		}
	}

	async getAllPlaylists() {
		return this.db
			.select()
			.from(schema.playlists)
			.orderBy(desc(schema.playlists.updatedAt))
	}

	async getPlaylistById(playlistId: number) {
		const list = await this.db
			.select()
			.from(schema.playlists)
			.where(eq(schema.playlists.id, playlistId))
			.limit(1)

		return list[0] ?? null
	}

	async getPlaylistTracks(playlistId: number) {
		const links = await this.db
			.select()
			.from(schema.playlistTracks)
			.where(eq(schema.playlistTracks.playlistId, playlistId))
			.orderBy(schema.playlistTracks.sortKey)

		if (links.length === 0) return []

		const trackIds = links.map((l) => l.trackId)
		const tracks = await Promise.all(
			trackIds.map((id) => this.getTrackDetails(id)),
		)

		return tracks.filter(Boolean)
	}

	async recordPlayHistory(params: {
		trackId: number
		startTime: number
		durationPlayed: number
		completed: boolean
	}) {
		return this.db.insert(schema.playHistory).values({
			trackId: params.trackId,
			startTime: params.startTime,
			durationPlayed: params.durationPlayed,
			completed: params.completed,
		})
	}

	async getRecentPlayHistory(limit = 50) {
		return this.db
			.select()
			.from(schema.playHistory)
			.orderBy(desc(schema.playHistory.startTime))
			.limit(limit)
	}

	async getLyricsCache(trackKey: string) {
		const result = await this.db
			.select()
			.from(schema.lyricsCache)
			.where(eq(schema.lyricsCache.trackKey, trackKey))
			.limit(1)

		return result[0] ?? null
	}

	async saveLyricsCache(params: {
		trackKey: string
		splContent?: string
		lrcContent?: string
		source?: string
	}) {
		const existing = await this.getLyricsCache(params.trackKey)
		if (existing) {
			return this.db
				.update(schema.lyricsCache)
				.set({
					splContent: params.splContent ?? existing.splContent,
					lrcContent: params.lrcContent ?? existing.lrcContent,
					source: params.source ?? existing.source,
					updatedAt: new Date(),
				})
				.where(eq(schema.lyricsCache.trackKey, params.trackKey))
		}

		return this.db.insert(schema.lyricsCache).values({
			trackKey: params.trackKey,
			splContent: params.splContent,
			lrcContent: params.lrcContent,
			source: params.source,
		})
	}
}
