import { Pool } from 'pg';
import { BottleDiscard } from '@domain/entities/BottleDiscard';
import {
  IBottleDiscardRepository,
  CreateBottleDiscardInput,
  ListBottleDiscardsInput,
} from '@domain/repositories/IBottleDiscardRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const BOTTLE_DISCARD_COLUMNS =
  'id, batch_entry_id, bottle_opening_id, discarded_at, discard_reason_id, remaining_doses, comment, is_cancelled, cancelled_by, cancelled_at, bulk_discard_id, created_by, created_at';

export class PgBottleDiscardRepository implements IBottleDiscardRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBottleDiscardInput): Promise<BottleDiscard> {
    const { rows } = await this.pool.query<BottleDiscard>(
      `INSERT INTO bottle_discards
         (batch_entry_id, bottle_opening_id, discarded_at, discard_reason_id, remaining_doses, comment, bulk_discard_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${BOTTLE_DISCARD_COLUMNS}`,
      [
        input.batch_entry_id,
        input.bottle_opening_id ?? null,
        input.discarded_at,
        input.discard_reason_id,
        input.remaining_doses ?? null,
        input.comment ?? null,
        input.bulk_discard_id ?? null,
        input.created_by,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<BottleDiscard | null> {
    const { rows } = await this.pool.query<BottleDiscard>(
      `SELECT ${BOTTLE_DISCARD_COLUMNS} FROM bottle_discards WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListBottleDiscardsInput): Promise<PaginatedResult<BottleDiscard>> {
    const { page, page_size, vaccine_room_id, batch_entry_id, search } = params;
    const offset = (page - 1) * page_size;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (batch_entry_id) {
      conditions.push(`batch_entry_id = $${values.length + 1}`);
      values.push(batch_entry_id);
    }
    if (vaccine_room_id) {
      // Join with batch_room_entries to filter by vaccine_room_id
      conditions.push(
        `batch_entry_id IN (SELECT id FROM batch_room_entries WHERE vaccine_room_id = $${values.length + 1} AND is_deleted = false)`,
      );
      values.push(vaccine_room_id);
    }
    addTextSearchCondition(conditions, values, search, ['comment']);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataValues = [...values, page_size, offset];
    const countValues = [...values];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<BottleDiscard>(
        `SELECT ${BOTTLE_DISCARD_COLUMNS} FROM bottle_discards
         ${whereClause}
         ORDER BY discarded_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM bottle_discards ${whereClause}`,
        countValues,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async cancel(id: string, cancelledBy: string): Promise<BottleDiscard | null> {
    const { rows } = await this.pool.query<BottleDiscard>(
      `UPDATE bottle_discards
       SET is_cancelled = true, cancelled_by = $2, cancelled_at = NOW()
       WHERE id = $1
       RETURNING ${BOTTLE_DISCARD_COLUMNS}`,
      [id, cancelledBy],
    );
    return rows[0] ?? null;
  }
}
