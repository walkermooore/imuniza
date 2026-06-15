import { Pool } from 'pg';
import { BulkBottleOpening } from '@domain/entities/BulkBottleOpening';
import {
  IBulkBottleOpeningRepository,
  CreateBulkBottleOpeningInput,
  ListBulkBottleOpeningsInput,
} from '@domain/repositories/IBulkBottleOpeningRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const BULK_BOTTLE_OPENING_COLUMNS =
  'id, batch_entry_id, vaccine_room_id, opened_at, quantity, quantity_executed, quantity_cancelled, comment, opening_reason_id, alert_triggered, created_by, created_at';

export class PgBulkBottleOpeningRepository implements IBulkBottleOpeningRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBulkBottleOpeningInput): Promise<BulkBottleOpening> {
    const { rows } = await this.pool.query<BulkBottleOpening>(
      `INSERT INTO bulk_bottle_openings
         (batch_entry_id, vaccine_room_id, opened_at, quantity, comment, opening_reason_id, alert_triggered, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${BULK_BOTTLE_OPENING_COLUMNS}`,
      [
        input.batch_entry_id,
        input.vaccine_room_id,
        input.opened_at,
        input.quantity,
        input.comment ?? null,
        input.opening_reason_id ?? null,
        input.alert_triggered,
        input.created_by,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<BulkBottleOpening | null> {
    const { rows } = await this.pool.query<BulkBottleOpening>(
      `SELECT ${BULK_BOTTLE_OPENING_COLUMNS} FROM bulk_bottle_openings WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListBulkBottleOpeningsInput): Promise<PaginatedResult<BulkBottleOpening>> {
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
      this.pool.query<BulkBottleOpening>(
        `SELECT ${BULK_BOTTLE_OPENING_COLUMNS} FROM bulk_bottle_openings
         ${whereClause}
         ORDER BY opened_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM bulk_bottle_openings ${whereClause}`,
        countValues,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }
}
