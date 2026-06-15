import { Pool } from 'pg';
import { TechnicianRoom } from '@domain/entities/TechnicianRoom';
import {
  ITechnicianRoomRepository,
  CreateTechnicianRoomInput,
  ListTechnicianRoomsInput,
} from '@domain/repositories/ITechnicianRoomRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const TECHNICIAN_ROOM_COLUMNS = 'id, user_id, vaccine_room_id, is_deleted, created_at';
const LIST_TECHNICIAN_ROOM_COLUMNS = 'tr.id, tr.user_id, tr.vaccine_room_id, tr.is_deleted, tr.created_at';

export class PgTechnicianRoomRepository implements ITechnicianRoomRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateTechnicianRoomInput): Promise<TechnicianRoom> {
    const { rows } = await this.pool.query<TechnicianRoom>(
      `INSERT INTO technician_rooms (user_id, vaccine_room_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING ${TECHNICIAN_ROOM_COLUMNS}`,
      [input.user_id, input.vaccine_room_id, input.created_by],
    );
    return rows[0];
  }

  async findById(id: string): Promise<TechnicianRoom | null> {
    const { rows } = await this.pool.query<TechnicianRoom>(
      `SELECT ${TECHNICIAN_ROOM_COLUMNS} FROM technician_rooms WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findActive(user_id: string, vaccine_room_id: string): Promise<TechnicianRoom | null> {
    const { rows } = await this.pool.query<TechnicianRoom>(
      `SELECT ${TECHNICIAN_ROOM_COLUMNS} FROM technician_rooms
       WHERE user_id = $1 AND vaccine_room_id = $2 AND is_deleted = false
       LIMIT 1`,
      [user_id, vaccine_room_id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListTechnicianRoomsInput): Promise<PaginatedResult<TechnicianRoom>> {
    const { page, page_size, user_id, vaccine_room_id, search } = params;
    const offset = (page - 1) * page_size;

    const conditions: string[] = ['tr.is_deleted = false'];
    const values: unknown[] = [];

    if (user_id) {
      conditions.push(`tr.user_id = $${values.length + 1}`);
      values.push(user_id);
    }
    if (vaccine_room_id) {
      conditions.push(`tr.vaccine_room_id = $${values.length + 1}`);
      values.push(vaccine_room_id);
    }
    addTextSearchCondition(conditions, values, search, ['u.name', 'vr.description']);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const dataValues = [...values, page_size, offset];
    const countValues = [...values];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<TechnicianRoom>(
        `SELECT ${LIST_TECHNICIAN_ROOM_COLUMNS}
         FROM technician_rooms tr
         JOIN users u ON u.id = tr.user_id
         JOIN vaccine_rooms vr ON vr.id = tr.vaccine_room_id
         ${whereClause}
         ORDER BY tr.created_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM technician_rooms tr
         JOIN users u ON u.id = tr.user_id
         JOIN vaccine_rooms vr ON vr.id = tr.vaccine_room_id
         ${whereClause}`,
        countValues,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE technician_rooms SET is_deleted = true WHERE id = $1`,
      [id],
    );
  }
}
