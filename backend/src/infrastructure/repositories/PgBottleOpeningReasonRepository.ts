import { Pool } from 'pg';
import { BottleOpeningReason } from '@domain/entities/BottleOpeningReason';
import {
  IBottleOpeningReasonRepository,
  CreateBottleOpeningReasonInput,
  UpdateBottleOpeningReasonInput,
} from '@domain/repositories/IBottleOpeningReasonRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const COLUMNS = 'id, name, is_default, is_deleted, created_at, updated_at';

export class PgBottleOpeningReasonRepository implements IBottleOpeningReasonRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBottleOpeningReasonInput): Promise<BottleOpeningReason> {
    const { rows } = await this.pool.query<BottleOpeningReason>(
      `INSERT INTO bottle_opening_reasons (name, is_default, created_by)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [input.name, input.is_default ?? false, input.created_by ?? null],
    );
    return rows[0];
  }

  async findById(id: string): Promise<BottleOpeningReason | null> {
    const { rows } = await this.pool.query<BottleOpeningReason>(
      `SELECT ${COLUMNS} FROM bottle_opening_reasons WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findDefault(): Promise<BottleOpeningReason | null> {
    const { rows } = await this.pool.query<BottleOpeningReason>(
      `SELECT ${COLUMNS} FROM bottle_opening_reasons WHERE is_default = true AND is_deleted = false LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<BottleOpeningReason>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;
    const conditions = ['is_deleted = false'];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['name']);

    const whereClause = conditions.join(' AND ');
    const dataValues = [...values, page_size, offset];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<BottleOpeningReason>(
        `SELECT ${COLUMNS} FROM bottle_opening_reasons WHERE ${whereClause}
         ORDER BY name
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM bottle_opening_reasons WHERE ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async update(id: string, input: UpdateBottleOpeningReasonInput): Promise<BottleOpeningReason | null> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const { rows } = await this.pool.query<BottleOpeningReason>(
      `UPDATE bottle_opening_reasons
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE bottle_opening_reasons SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
