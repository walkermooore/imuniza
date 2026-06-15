import { Pool } from 'pg';
import { Location } from '@domain/entities/Location';
import {
  ILocationRepository,
  CreateLocationInput,
  UpdateLocationInput,
} from '@domain/repositories/ILocationRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const LOCATION_COLUMNS =
  'id, name, address, type, other_description, is_deleted, deleted_by, deleted_at, created_at, updated_at';

export class PgLocationRepository implements ILocationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateLocationInput): Promise<Location> {
    const { rows } = await this.pool.query<Location>(
      `INSERT INTO locations (name, address, type, other_description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${LOCATION_COLUMNS}`,
      [input.name, input.address, input.type, input.other_description ?? null, input.created_by ?? null],
    );
    return rows[0];
  }

  async findById(id: string): Promise<Location | null> {
    const { rows } = await this.pool.query<Location>(
      `SELECT ${LOCATION_COLUMNS} FROM locations WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Location>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;
    const conditions = ['is_deleted = false'];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['name', 'other_description', 'address']);

    const whereClause = conditions.join(' AND ');
    const dataValues = [...values, page_size, offset];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<Location>(
        `SELECT ${LOCATION_COLUMNS} FROM locations WHERE ${whereClause}
         ORDER BY name
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM locations WHERE ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async update(id: string, input: UpdateLocationInput): Promise<Location | null> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const { rows } = await this.pool.query<Location>(
      `UPDATE locations
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING ${LOCATION_COLUMNS}`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE locations
       SET is_deleted = true, deleted_by = $2, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, deletedBy],
    );
  }
}
