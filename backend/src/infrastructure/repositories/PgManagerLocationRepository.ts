import { Pool } from 'pg';
import { ManagerLocation } from '@domain/entities/ManagerLocation';
import {
  IManagerLocationRepository,
  CreateManagerLocationInput,
  ListManagerLocationsInput,
} from '@domain/repositories/IManagerLocationRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const MANAGER_LOCATION_COLUMNS = 'id, user_id, location_id, is_deleted, created_at';
const LIST_MANAGER_LOCATION_COLUMNS = 'ml.id, ml.user_id, ml.location_id, ml.is_deleted, ml.created_at';

export class PgManagerLocationRepository implements IManagerLocationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateManagerLocationInput): Promise<ManagerLocation> {
    const { rows } = await this.pool.query<ManagerLocation>(
      `INSERT INTO manager_locations (user_id, location_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING ${MANAGER_LOCATION_COLUMNS}`,
      [input.user_id, input.location_id, input.created_by],
    );
    return rows[0];
  }

  async findById(id: string): Promise<ManagerLocation | null> {
    const { rows } = await this.pool.query<ManagerLocation>(
      `SELECT ${MANAGER_LOCATION_COLUMNS} FROM manager_locations WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findActive(user_id: string, location_id: string): Promise<ManagerLocation | null> {
    const { rows } = await this.pool.query<ManagerLocation>(
      `SELECT ${MANAGER_LOCATION_COLUMNS} FROM manager_locations
       WHERE user_id = $1 AND location_id = $2 AND is_deleted = false
       LIMIT 1`,
      [user_id, location_id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListManagerLocationsInput): Promise<PaginatedResult<ManagerLocation>> {
    const { page, page_size, user_id, location_id, search } = params;
    const offset = (page - 1) * page_size;

    const conditions: string[] = ['ml.is_deleted = false'];
    const values: unknown[] = [];

    if (user_id) {
      conditions.push(`ml.user_id = $${values.length + 1}`);
      values.push(user_id);
    }
    if (location_id) {
      conditions.push(`ml.location_id = $${values.length + 1}`);
      values.push(location_id);
    }
    addTextSearchCondition(conditions, values, search, ['u.name', 'l.name']);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const dataValues = [...values, page_size, offset];
    const countValues = [...values];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<ManagerLocation>(
        `SELECT ${LIST_MANAGER_LOCATION_COLUMNS}
         FROM manager_locations ml
         JOIN users u ON u.id = ml.user_id
         JOIN locations l ON l.id = ml.location_id
         ${whereClause}
         ORDER BY ml.created_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM manager_locations ml
         JOIN users u ON u.id = ml.user_id
         JOIN locations l ON l.id = ml.location_id
         ${whereClause}`,
        countValues,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE manager_locations SET is_deleted = true WHERE id = $1`,
      [id],
    );
  }
}
