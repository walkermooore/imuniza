import { Pool } from 'pg';
import { Batch } from '@domain/entities/Batch';
import {
  IBatchRepository,
  CreateBatchInput,
  UpdateBatchInput,
} from '@domain/repositories/IBatchRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const BATCH_COLUMNS =
  'id, batch_code, vaccine_id, expiry_date, closed_bottle_expiry_date, open_bottle_expiry_minutes, doses_per_bottle, ml_per_dose, is_deleted, created_by, created_at, updated_at';
const LIST_BATCH_COLUMNS =
  'b.id, b.batch_code, b.vaccine_id, b.expiry_date, b.closed_bottle_expiry_date, b.open_bottle_expiry_minutes, b.doses_per_bottle, b.ml_per_dose, b.is_deleted, b.created_by, b.created_at, b.updated_at';

export class PgBatchRepository implements IBatchRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBatchInput): Promise<Batch> {
    const { rows } = await this.pool.query<Batch>(
      `INSERT INTO batches (batch_code, vaccine_id, expiry_date, closed_bottle_expiry_date, open_bottle_expiry_minutes, doses_per_bottle, ml_per_dose, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${BATCH_COLUMNS}`,
      [
        input.batch_code,
        input.vaccine_id,
        input.expiry_date,
        input.closed_bottle_expiry_date,
        input.open_bottle_expiry_minutes,
        input.doses_per_bottle,
        input.ml_per_dose,
        input.created_by,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<Batch | null> {
    const { rows } = await this.pool.query<Batch>(
      `SELECT ${BATCH_COLUMNS} FROM batches WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByCodeAndVaccine(batch_code: string, vaccine_id: string): Promise<Batch | null> {
    const { rows } = await this.pool.query<Batch>(
      `SELECT ${BATCH_COLUMNS} FROM batches WHERE batch_code = $1 AND vaccine_id = $2 AND is_deleted = false LIMIT 1`,
      [batch_code, vaccine_id],
    );
    return rows[0] ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Batch>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;
    const conditions = ['b.is_deleted = false'];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['b.batch_code', 'v.name']);

    const whereClause = conditions.join(' AND ');
    const dataValues = [...values, page_size, offset];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<Batch>(
        `SELECT ${LIST_BATCH_COLUMNS}
         FROM batches b
         JOIN vaccines v ON v.id = b.vaccine_id
         WHERE ${whereClause}
         ORDER BY b.created_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM batches b
         JOIN vaccines v ON v.id = b.vaccine_id
         WHERE ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async update(id: string, input: UpdateBatchInput): Promise<Batch | null> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const { rows } = await this.pool.query<Batch>(
      `UPDATE batches
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${BATCH_COLUMNS}`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE batches SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
