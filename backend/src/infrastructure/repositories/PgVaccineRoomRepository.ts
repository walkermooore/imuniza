import { Pool } from 'pg';
import { VaccineRoom } from '@domain/entities/VaccineRoom';
import {
  IVaccineRoomRepository,
  CreateVaccineRoomInput,
  UpdateVaccineRoomInput,
} from '@domain/repositories/IVaccineRoomRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const VACCINE_ROOM_COLUMNS =
  'vr.id, vr.location_id, l.name AS location_name, vr.description, vr.is_deleted, vr.deleted_by, vr.deleted_at, vr.created_at, vr.updated_at';

export class PgVaccineRoomRepository implements IVaccineRoomRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateVaccineRoomInput): Promise<VaccineRoom> {
    const { rows } = await this.pool.query<VaccineRoom>(
      `WITH inserted AS (
         INSERT INTO vaccine_rooms (location_id, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, location_id, description, is_deleted, deleted_by, deleted_at, created_at, updated_at
       )
       SELECT ${VACCINE_ROOM_COLUMNS}
       FROM inserted vr
       JOIN locations l ON l.id = vr.location_id`,
      [input.location_id, input.description, input.created_by ?? null],
    );
    return rows[0];
  }

  async findById(id: string): Promise<VaccineRoom | null> {
    const { rows } = await this.pool.query<VaccineRoom>(
      `SELECT ${VACCINE_ROOM_COLUMNS}
       FROM vaccine_rooms vr
       JOIN locations l ON l.id = vr.location_id
       WHERE vr.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(
    params: PaginationParams & { location_id?: string },
  ): Promise<PaginatedResult<VaccineRoom>> {
    const { page, page_size, location_id, search } = params;
    const offset = (page - 1) * page_size;

    const conditions: string[] = ['vr.is_deleted = false'];
    const values: unknown[] = [];

    if (location_id) {
      conditions.push(`vr.location_id = $${values.length + 1}`);
      values.push(location_id);
    }
    addTextSearchCondition(conditions, values, search, ['vr.description', 'l.name']);

    const where = conditions.join(' AND ');
    const dataValues = [...values, page_size, offset];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<VaccineRoom>(
        `SELECT ${VACCINE_ROOM_COLUMNS}
         FROM vaccine_rooms vr
         JOIN locations l ON l.id = vr.location_id
         WHERE ${where}
         ORDER BY vr.description
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM vaccine_rooms vr
         JOIN locations l ON l.id = vr.location_id
         WHERE ${where}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async update(id: string, input: UpdateVaccineRoomInput): Promise<VaccineRoom | null> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id);

    const setClause = fields.map(([key], i) => `${key} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const { rows } = await this.pool.query<VaccineRoom>(
      `WITH updated AS (
         UPDATE vaccine_rooms
         SET ${setClause}, updated_at = NOW()
         WHERE id = $1
         RETURNING id, location_id, description, is_deleted, deleted_by, deleted_at, created_at, updated_at
       )
       SELECT ${VACCINE_ROOM_COLUMNS}
       FROM updated vr
       JOIN locations l ON l.id = vr.location_id`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE vaccine_rooms
       SET is_deleted = true, deleted_by = $2, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, deletedBy],
    );
  }
}
