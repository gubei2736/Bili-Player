import { relations, sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const artists = sqliteTable(
	'artists',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		avatarUrl: text('avatar_url'),
		signature: text('signature'),
		source: text('source', {
			enum: ['bilibili', 'local'],
		}).notNull(),
		remoteId: text('remote_id'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('source_remote_id_unq')
			.on(table.source, table.remoteId)
			.where(sql`source != 'local'`),
		uniqueIndex('local_artist_unq')
			.on(table.name)
			.where(sql`source = 'local'`),
		index('artists_name_idx').on(table.name),
		check(
			'source_integrity_check',
			sql`
        (source = 'local' AND remote_id IS NULL) 
        OR 
        (source != 'local' AND remote_id IS NOT NULL)
      `,
		),
	],
)

export const tracks = sqliteTable(
	'tracks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		uniqueKey: text('unique_key').unique().notNull(),
		title: text('title').notNull(),
		artistId: integer('artist_id').references(() => artists.id, {
			onDelete: 'set null',
		}),
		coverUrl: text('cover_url'),
		duration: integer('duration'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		source: text('source', {
			enum: ['bilibili', 'local'],
		}).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('tracks_artist_idx').on(table.artistId),
		index('tracks_title_idx').on(table.title),
		index('tracks_source_idx').on(table.source),
	],
)

export const playHistory = sqliteTable(
	'play_history',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		trackId: integer('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		startTime: integer('start_time').notNull(),
		durationPlayed: integer('duration_played').notNull(),
		completed: integer('completed', { mode: 'boolean' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		index('play_history_track_idx').on(table.trackId),
		index('play_history_start_time_idx').on(table.startTime),
	],
)

export const playlists = sqliteTable(
	'playlists',
	{
		playerPreference: text('player_preference', {
			enum: ['inherit', 'music', 'podcast'],
		})
			.notNull()
			.default('inherit'),
		id: integer('id').primaryKey({ autoIncrement: true }),
		title: text('title').notNull(),
		authorId: integer('author_id').references(() => artists.id, {
			onDelete: 'set null',
		}),
		description: text('description'),
		coverUrl: text('cover_url'),
		itemCount: integer('item_count').notNull().default(0),
		type: text('type', {
			enum: [
				'favorite',
				'collection',
				'series',
				'multi_page',
				'local',
				'dynamic',
			],
		}).notNull(),
		remoteSyncId: integer('remote_sync_id'),
		lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
		shareId: text('share_id'),
		shareRole: text('share_role', {
			enum: ['owner', 'editor', 'subscriber'],
		}),
		lastShareSyncAt: integer('last_share_sync_at', { mode: 'timestamp_ms' }),
		isPinned: integer('is_pinned', { mode: 'boolean' })
			.notNull()
			.default(false),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('playlists_title_idx').on(table.title),
		index('playlists_type_idx').on(table.type),
		index('playlists_author_idx').on(table.authorId),
		index('playlists_share_id_idx').on(table.shareId),
	],
)

export const dynamicPlaylistSources = sqliteTable(
	'dynamic_playlist_sources',
	{
		playlistId: integer('playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }),
		sourcePlaylistId: integer('source_playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		primaryKey({ columns: [table.playlistId, table.sourcePlaylistId] }),
		index('dynamic_playlist_sources_playlist_idx').on(table.playlistId),
		index('dynamic_playlist_sources_playlist_position_idx').on(
			table.playlistId,
			table.position,
		),
		index('dynamic_playlist_sources_source_idx').on(table.sourcePlaylistId),
	],
)

export const playlistTracks = sqliteTable(
	'playlist_tracks',
	{
		playlistId: integer('playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }),
		trackId: integer('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		sortKey: text('sort_key').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		primaryKey({ columns: [table.playlistId, table.trackId] }),
		index('playlist_tracks_track_idx').on(table.trackId),
		index('playlist_tracks_sort_key_idx').on(table.playlistId, table.sortKey),
	],
)

export const bilibiliMetadata = sqliteTable(
	'bilibili_metadata',
	{
		trackId: integer('track_id')
			.primaryKey()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		bvid: text('bvid').notNull(),
		cid: integer('cid'),
		isMultiPage: integer('is_multi_page', { mode: 'boolean' }).notNull(),
		mainTrackTitle: text('main_track_title'),
		videoIsValid: integer('video_is_valid', { mode: 'boolean' })
			.notNull()
			.default(true),
	},
	(table) => [
		index('bilibili_metadata_bvid_cid_idx').on(table.bvid, table.cid),
	],
)

export const localMetadata = sqliteTable('local_metadata', {
	trackId: integer('track_id')
		.primaryKey()
		.references(() => tracks.id, { onDelete: 'cascade' }),
	localPath: text('local_path').notNull(),
})

export const playlistSyncQueue = sqliteTable(
	'playlist_sync_queue',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		playlistId: integer('playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }),
		operation: text('operation', {
			enum: ['add_tracks', 'remove_tracks', 'reorder_track', 'update_metadata'],
		}).notNull(),
		payload: text('payload', { mode: 'json' }).notNull(),
		status: text('status', {
			enum: ['pending', 'syncing', 'done', 'failed'],
		})
			.notNull()
			.default('pending'),
		operationAt: integer('operation_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		index('playlist_sync_queue_status_idx').on(table.status),
		index('playlist_sync_queue_playlist_id_idx').on(table.playlistId),
	],
)

export const lyricsCache = sqliteTable(
	'lyrics_cache',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		trackKey: text('track_key').notNull().unique(),
		splContent: text('spl_content'),
		lrcContent: text('lrc_content'),
		source: text('source'),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('lyrics_cache_track_key_idx').on(table.trackKey),
	],
)

// ##################################
// RELATIONS
// ##################################
export const artistRelations = relations(artists, ({ many }) => ({
	tracks: many(tracks),
	authoredPlaylists: many(playlists),
}))

export const trackRelations = relations(tracks, ({ one, many }) => ({
	artist: one(artists, {
		fields: [tracks.artistId],
		references: [artists.id],
	}),
	playlistLinks: many(playlistTracks),
	bilibiliMetadata: one(bilibiliMetadata, {
		fields: [tracks.id],
		references: [bilibiliMetadata.trackId],
	}),
	localMetadata: one(localMetadata, {
		fields: [tracks.id],
		references: [localMetadata.trackId],
	}),
	playHistory: many(playHistory),
}))

export const playHistoryRelations = relations(playHistory, ({ one }) => ({
	track: one(tracks, {
		fields: [playHistory.trackId],
		references: [tracks.id],
	}),
}))

export const playlistRelations = relations(playlists, ({ one, many }) => ({
	author: one(artists, {
		fields: [playlists.authorId],
		references: [artists.id],
	}),
	trackLinks: many(playlistTracks),
	dynamicSources: many(dynamicPlaylistSources, {
		relationName: 'dynamicPlaylist',
	}),
	dynamicDependents: many(dynamicPlaylistSources, {
		relationName: 'dynamicSourcePlaylist',
	}),
}))

export const dynamicPlaylistSourceRelations = relations(
	dynamicPlaylistSources,
	({ one }) => ({
		playlist: one(playlists, {
			fields: [dynamicPlaylistSources.playlistId],
			references: [playlists.id],
			relationName: 'dynamicPlaylist',
		}),
		sourcePlaylist: one(playlists, {
			fields: [dynamicPlaylistSources.sourcePlaylistId],
			references: [playlists.id],
			relationName: 'dynamicSourcePlaylist',
		}),
	}),
)

export const playlistTrackRelations = relations(playlistTracks, ({ one }) => ({
	playlist: one(playlists, {
		fields: [playlistTracks.playlistId],
		references: [playlists.id],
	}),
	track: one(tracks, {
		fields: [playlistTracks.trackId],
		references: [tracks.id],
	}),
}))

export const bilibiliMetadataRelations = relations(
	bilibiliMetadata,
	({ one }) => ({
		track: one(tracks, {
			fields: [bilibiliMetadata.trackId],
			references: [tracks.id],
		}),
	}),
)

export const localMetadataRelations = relations(localMetadata, ({ one }) => ({
	track: one(tracks, {
		fields: [localMetadata.trackId],
		references: [tracks.id],
	}),
}))
