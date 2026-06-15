import { Pool } from 'pg';
import { BottleOpening } from '@domain/entities/BottleOpening';
import {
  IBottleOpeningRepository,
  CreateBottleOpeningInput,
  ListBottleOpeningsInput,
} from '@domain/repositories/IBottleOpeningRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const BOTTLE_OPENING_COLUMNS =
  'bottle_openings.id, batch_entry_id, vaccine_room_id, opened_at, comment, opening_reason_id, alert_triggered, is_cancelled, cancelled_by, cancelled_at, bulk_opening_id, bottle_openings.created_by, bottle_openings.created_at';

export class PgBottleOpeningRepository implements IBottleOpeningRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBottleOpeningInput): Promise<BottleOpening> {
    const { rows } = await this.pool.query<BottleOpening>(
      `INSERT INTO bottle_openings
         (batch_entry_id, vaccine_room_id, opened_at, comment, opening_reason_id, alert_triggered, bulk_opening_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${BOTTLE_OPENING_COLUMNS}`,
      [
        input.batch_entry_id,
        input.vaccine_room_id,
        input.opened_at,
        input.comment ?? null,
        input.opening_reason_id ?? null,
        input.alert_triggered,
        input.bulk_opening_id ?? null,
        input.created_by,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<BottleOpening | null> {
    const { rows } = await this.pool.query<BottleOpening>(
      `SELECT ${BOTTLE_OPENING_COLUMNS} FROM bottle_openings WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListBottleOpeningsInput): Promise<PaginatedResult<BottleOpening>> {
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
      this.pool.query<BottleOpening>(
        `SELECT ${BOTTLE_OPENING_COLUMNS}, u.name as user_name
         FROM bottle_openings
         JOIN users u ON u.id = bottle_openings.created_by
         ${whereClause}
         ORDER BY opened_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM bottle_openings ${whereClause}`,
        countValues,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async cancel(id: string, cancelledBy: string): Promise<BottleOpening | null> {
    const { rows } = await this.pool.query<BottleOpening>(
      `UPDATE bottle_openings
       SET is_cancelled = true, cancelled_by = $2, cancelled_at = NOW()
       WHERE id = $1
       RETURNING ${BOTTLE_OPENING_COLUMNS}`,
      [id, cancelledBy],
    );
    return rows[0] ?? null;
  }
}
