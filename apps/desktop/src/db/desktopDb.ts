import Database from '@tauri-apps/plugin-sql'
import * as schema from '@bbplayer/shared-core/db/schema'
import { DatabaseQueries, drizzle } from '@bbplayer/shared-core/db'

let dbInstance: ReturnType<typeof drizzle> | null = null
let queriesInstance: DatabaseQueries | null = null

const INIT_SQL_TABLES = [
	`CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    signature TEXT,
    source TEXT NOT NULL,
    remote_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );`,
	`CREATE UNIQUE INDEX IF NOT EXISTS source_remote_id_unq ON artists (source, remote_id) WHERE source != 'local';`,
	`CREATE UNIQUE INDEX IF NOT EXISTS local_artist_unq ON artists (name) WHERE source = 'local';`,
	`CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unique_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    cover_url TEXT,
    duration INTEGER,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );`,
	`CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    start_time INTEGER NOT NULL,
    duration_played INTEGER NOT NULL,
    completed INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );`,
	`CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    description TEXT,
    cover_url TEXT,
    item_count INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    player_preference TEXT NOT NULL DEFAULT 'inherit',
    remote_sync_id INTEGER,
    last_synced_at INTEGER,
    share_id TEXT,
    share_role TEXT,
    last_share_sync_at INTEGER,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );`,
	`CREATE TABLE IF NOT EXISTS dynamic_playlist_sources (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    source_playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    PRIMARY KEY (playlist_id, source_playlist_id)
  );`,
	`CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    sort_key TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    PRIMARY KEY (playlist_id, track_id)
  );`,
	`CREATE TABLE IF NOT EXISTS bilibili_metadata (
    track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    bvid TEXT NOT NULL,
    cid INTEGER,
    is_multi_page INTEGER NOT NULL,
    main_track_title TEXT,
    video_is_valid INTEGER NOT NULL DEFAULT 1
  );`,
	`CREATE TABLE IF NOT EXISTS local_metadata (
    track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    local_path TEXT NOT NULL
  );`,
	`CREATE TABLE IF NOT EXISTS playlist_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    operation_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );`,
	`CREATE TABLE IF NOT EXISTS lyrics_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_key TEXT NOT NULL UNIQUE,
    spl_content TEXT,
    lrc_content TEXT,
    source TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );`,
]

export async function initDesktopDatabase(): Promise<{
	db: ReturnType<typeof drizzle>
	queries: DatabaseQueries
}> {
	if (dbInstance && queriesInstance) {
		return { db: dbInstance, queries: queriesInstance }
	}

	try {
		const sqlite = await Database.load('sqlite:bbplayer.db')

		// Run automated schema migrations / creation
		for (const ddl of INIT_SQL_TABLES) {
			await sqlite.execute(ddl)
		}

		// Drizzle SQLite Proxy adapter for Tauri plugin-sql
		const db = drizzle(
			async (sqlQuery: string, params: unknown[], method: 'all' | 'run' | 'get' | 'values') => {
				try {
					if (method === 'all' || method === 'values') {
						const rows = await sqlite.select<Record<string, unknown>[]>(
							sqlQuery,
							params as any[],
						)
						// Drizzle sqlite-proxy values expects an array of arrays
						const values = rows.map((r) => Object.values(r))
						return { rows: method === 'values' ? values : (rows as any) }
					} else {
						await sqlite.execute(sqlQuery, params as any[])
						return { rows: [] }
					}
				} catch (err) {
					console.error('[DesktopDb] SQL Execution error:', err, sqlQuery, params)
					throw err
				}
			},
			{ schema },
		)

		dbInstance = db
		queriesInstance = new DatabaseQueries(db as any)

		console.log('[DesktopDb] SQLite database initialized successfully.')
		return { db, queries: queriesInstance }
	} catch (error) {
		console.warn(
			'[DesktopDb] Fallback or error initializing Tauri SQLite plugin:',
			error,
		)
		throw error
	}
}

export function getDatabaseQueries(): DatabaseQueries | null {
	return queriesInstance
}
