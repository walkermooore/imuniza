import { Pool } from 'pg';
import { BulkBottleDiscard } from '@domain/entities/BulkBottleDiscard';
import {
  IBulkBottleDiscardRepository,
  CreateBulkBottleDiscardInput,
  ListBulkBottleDiscardsInput,
} from '@domain/repositories/IBulkBottleDiscardRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const BULK_BOTTLE_DISCARD_COLUMNS =
  'id, batch_entry_id, vaccine_room_id, mode, discarded_at, discard_reason_id, quantity, quantity_executed, quantity_cancelled, comment, created_by, created_at';

export class PgBulkBottleDiscardRepository implements IBulkBottleDiscardRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBulkBottleDiscardInput): Promise<BulkBottleDiscard> {
    const { rows } = await this.pool.query<BulkBottleDiscard>(
      `INSERT INTO bulk_bottle_discards
         (batch_entry_id, vaccine_room_id, mode, discarded_at, discard_reason_id, quantity, comment, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${BULK_BOTTLE_DISCARD_COLUMNS}`,
      [
        input.batch_entry_id,
        input.vaccine_room_id,
        input.mode,
        input.discarded_at,
        input.discard_reason_id,
        input.quantity,
        input.comment ?? null,
        input.created_by,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<BulkBottleDiscard | null> {
    const { rows } = await this.pool.query<BulkBottleDiscard>(
      `SELECT ${BULK_BOTTLE_DISCARD_COLUMNS} FROM bulk_bottle_discards WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListBulkBottleDiscardsInput): Promise<PaginatedResult<BulkBottleDiscard>> {
    const { page, page_size, vaccine_room_id, batch_entry_id, search } = params;
    const offset = (page - 1) * page_size;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (vaccine_room_id) {
      conditions.push(`vaccine_room_id = $${values.length + 1}`);
      values.push(vaccine_room_id);
    }
    if (batch_entry_id) {
      conditions.push(`batch_entry_id = $${values.length + 1}`);
      values.push(batch_entry_id);
    }
    addTextSearchCondition(conditions, values, search, ['comment']);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataValues = [...values, page_size, offset];
    const countValues = [...values];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<BulkBottleDiscard>(
        `SELECT ${BULK_BOTTLE_DISCARD_COLUMNS} FROM bulk_bottle_discards
         ${whereClause}
         ORDER BY discarded_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM bulk_bottle_discards ${whereClause}`,
        countValues,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }
}
