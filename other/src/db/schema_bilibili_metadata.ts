/**
 * 来源自 packages/shared-core/src/db/schema.ts
 * 本地 SQLite 数据库中关于 bilibili_metadata 的持久化表设计
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

// 假设 tracks 表
export const tracks = sqliteTable('tracks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	uniqueKey: text('unique_key').notNull().unique(),
	title: text('title').notNull(),
	// ...
})

/**
 * Bilibili 扩展元数据表
 * 关键字段:
 * - bvid: 稿件 ID
 * - cid: 该分 P 具体的 content ID (如果是整视频可能为 null，如果是具体分 P 则有明确数值)
 * - isMultiPage: 标识当前是否属于多分 P 视频
 * - mainTrackTitle: 所属稿件的主标题
 */
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
