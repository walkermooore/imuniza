import { Pool } from 'pg';
import { BatchRoomEntry } from '@domain/entities/BatchRoomEntry';
import {
  IBatchRoomEntryRepository,
  CreateBatchRoomEntryInput,
  ListBatchRoomEntriesInput,
} from '@domain/repositories/IBatchRoomEntryRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const BATCH_ROOM_ENTRY_COLUMNS =
  'id, batch_id, vaccine_room_id, bottle_count, source_batch_entry_id, is_deleted, created_by, created_at';
const LIST_BATCH_ROOM_ENTRY_COLUMNS =
  'bre.id, bre.batch_id, bre.vaccine_room_id, bre.bottle_count, bre.source_batch_entry_id, bre.is_deleted, bre.created_by, bre.created_at';

export class PgBatchRoomEntryRepository implements IBatchRoomEntryRepository {
  constructor(private readonly pool: Pool) { }

  async create(input: CreateBatchRoomEntryInput): Promise<BatchRoomEntry> {
    const { rows } = await this.pool.query<BatchRoomEntry>(
      `INSERT INTO batch_room_entries (batch_id, vaccine_room_id, bottle_count, source_batch_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${BATCH_ROOM_ENTRY_COLUMNS}`,
      [
        input.batch_id,
        input.vaccine_room_id,
        input.bottle_count,
        input.source_batch_entry_id ?? null,
        input.created_by,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<BatchRoomEntry | null> {
    const { rows } = await this.pool.query<BatchRoomEntry>(
      `SELECT ${BATCH_ROOM_ENTRY_COLUMNS} FROM batch_room_entries WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListBatchRoomEntriesInput): Promise<PaginatedResult<BatchRoomEntry>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;

    const conditions: string[] = ['bre.is_deleted = false'];
    const values: unknown[] = [];

    if (params.batch_id) {
      values.push(params.batch_id);
      conditions.push(`bre.batch_id = $${values.length}`);
    }
    if (params.vaccine_room_id) {
      values.push(params.vaccine_room_id);
      conditions.push(`bre.vaccine_room_id = $${values.length}`);
    }
    if (params.vaccine_room_ids && params.vaccine_room_ids.length > 0) {
      const placeholders = params.vaccine_room_ids
        .map((_, i) => `$${values.length + i + 1}`)
        .join(', ');
      conditions.push(`bre.vaccine_room_id IN (${placeholders})`);
      values.push(...params.vaccine_room_ids);
    }

    addTextSearchCondition(conditions, values, search, ['b.batch_code', 'vr.description', 'l.name', 'v.name', 'labs.name']);

    const where = conditions.join(' AND ');
    const dataOffset = values.length + 1;
    const dataLimit = values.length + 2;

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<BatchRoomEntry>(
        `SELECT ${LIST_BATCH_ROOM_ENTRY_COLUMNS}
         FROM batch_room_entries bre
         JOIN batches b ON b.id = bre.batch_id
         JOIN vaccine_rooms vr ON vr.id = bre.vaccine_room_id
         JOIN locations l ON l.id = vr.location_id
         JOIN vaccines v ON v.id = b.vaccine_id
         JOIN laboratories labs ON labs.id = v.laboratory_id
         WHERE ${where}
         ORDER BY bre.created_at DESC
         LIMIT $${dataLimit} OFFSET $${dataOffset}`,
        [...values, offset, page_size],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM batch_room_entries bre
         JOIN batches b ON b.id = bre.batch_id
         JOIN vaccine_rooms vr ON vr.id = bre.vaccine_room_id
         JOIN locations l ON l.id = vr.location_id
         JOIN vaccines v ON v.id = b.vaccine_id
         JOIN laboratories labs ON labs.id = v.laboratory_id
         WHERE ${where}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE batch_room_entries SET is_deleted = true WHERE id = $1`,
      [id],
    );
  }
}
