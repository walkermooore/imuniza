import { Pool } from 'pg';
import { Laboratory } from '@domain/entities/Laboratory';
import {
  ILaboratoryRepository,
  CreateLaboratoryInput,
  UpdateLaboratoryInput,
} from '@domain/repositories/ILaboratoryRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const COLUMNS = 'id, name, is_deleted, created_at, updated_at';

export class PgLaboratoryRepository implements ILaboratoryRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateLaboratoryInput): Promise<Laboratory> {
    const { rows } = await this.pool.query<Laboratory>(
      `INSERT INTO laboratories (name, created_by)
       VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [input.name, input.created_by ?? null],
    );
    return rows[0];
  }

  async findById(id: string): Promise<Laboratory | null> {
    const { rows } = await this.pool.query<Laboratory>(
      `SELECT ${COLUMNS} FROM laboratories WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Laboratory>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;
    const conditions = ['is_deleted = false'];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['name']);

    const whereClause = conditions.join(' AND ');
    const dataValues = [...values, page_size, offset];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<Laboratory>(
        `SELECT ${COLUMNS} FROM laboratories WHERE ${whereClause}
         ORDER BY name
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM laboratories WHERE ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async update(id: string, input: UpdateLaboratoryInput): Promise<Laboratory | null> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const { rows } = await this.pool.query<Laboratory>(
      `UPDATE laboratories
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE laboratories SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
