import { Pool } from 'pg';
import { Vaccine } from '@domain/entities/Vaccine';
import {
  IVaccineRepository,
  CreateVaccineInput,
  UpdateVaccineInput,
} from '@domain/repositories/IVaccineRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const COLUMNS = 'id, name, laboratory_id, is_deleted, created_at, updated_at';
const LIST_COLUMNS = `
  v.id,
  v.name,
  v.laboratory_id,
  l.name AS laboratory_name,
  v.is_deleted,
  v.created_at,
  v.updated_at
`;

export class PgVaccineRepository implements IVaccineRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateVaccineInput): Promise<Vaccine> {
    const { rows } = await this.pool.query<Vaccine>(
      `INSERT INTO vaccines (name, laboratory_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [input.name, input.laboratory_id, input.created_by ?? null],
    );
    return rows[0];
  }

  async findById(id: string): Promise<Vaccine | null> {
    const { rows } = await this.pool.query<Vaccine>(
      `SELECT ${COLUMNS} FROM vaccines WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Vaccine>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;
    const conditions = ['v.is_deleted = false'];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['v.name', 'l.name']);

    const whereClause = conditions.join(' AND ');
    const dataValues = [...values, page_size, offset];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<Vaccine>(
        `SELECT ${LIST_COLUMNS}
         FROM vaccines v
         INNER JOIN laboratories l ON l.id = v.laboratory_id
         WHERE ${whereClause}
         ORDER BY v.name
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM vaccines v
         INNER JOIN laboratories l ON l.id = v.laboratory_id
         WHERE ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async update(id: string, input: UpdateVaccineInput): Promise<Vaccine | null> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const { rows } = await this.pool.query<Vaccine>(
      `UPDATE vaccines
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE vaccines SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
