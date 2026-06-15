import { Pool } from 'pg';
import { Notification } from '@domain/entities/Notification';
import {
  INotificationRepository,
  CreateNotificationInput,
} from '@domain/repositories/INotificationRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const COLUMNS = 'id, user_id, event_type, entity_id, entity_table, source_vaccine_room_id, is_read, read_at, created_at';

interface DbRow {
  id: string;
  user_id: string;
  event_type: 'bottle_opening' | 'bottle_discard';
  entity_id: string;
  entity_table: string;
  source_vaccine_room_id: string;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
}

interface DbRowWithDescription extends DbRow {
  description: string;
}

function toEntity(row: DbRow): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    event_type: row.event_type,
    entity_id: row.entity_id,
    entity_table: row.entity_table,
    source_vaccine_room_id: row.source_vaccine_room_id,
    is_read: row.is_read,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

export class PgNotificationRepository implements INotificationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const { rows } = await this.pool.query<DbRow>(
      `INSERT INTO notifications (user_id, event_type, entity_id, entity_table, source_vaccine_room_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [
        input.user_id,
        input.event_type,
        input.entity_id,
        input.entity_table,
        input.source_vaccine_room_id,
        input.created_by,
      ],
    );
    return toEntity(rows[0]);
  }

  async findByUserId(
    userId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<Notification & { description: string }>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;

    const descriptionExpr = `
      CASE
        WHEN n.entity_table = 'bottle_openings' THEN
          'Frasco de ' || v1.name || ' aberto na ' || vr.description
        WHEN n.entity_table = 'bulk_bottle_openings' THEN
          'Frasco de ' || v2.name || ' aberto na ' || vr.description
        WHEN n.entity_table = 'bottle_discards' THEN
          'Frasco de ' || v3.name || ' descartado na ' || vr.description
        ELSE 'Evento de notificação'
      END
    `;

    const conditions = ['n.user_id = $1'];
    const values: unknown[] = [userId];

    addTextSearchCondition(conditions, values, search, [descriptionExpr]);

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      FROM notifications n
      JOIN vaccine_rooms vr ON vr.id = n.source_vaccine_room_id
      LEFT JOIN bottle_openings bo ON bo.id = n.entity_id AND n.entity_table = 'bottle_openings'
      LEFT JOIN batch_room_entries bre1 ON bre1.id = bo.batch_entry_id
      LEFT JOIN batches b1 ON b1.id = bre1.batch_id
      LEFT JOIN vaccines v1 ON v1.id = b1.vaccine_id
      LEFT JOIN bulk_bottle_openings bbo ON bbo.id = n.entity_id AND n.entity_table = 'bulk_bottle_openings'
      LEFT JOIN batch_room_entries bre2 ON bre2.id = bbo.batch_entry_id
      LEFT JOIN batches b2 ON b2.id = bre2.batch_id
      LEFT JOIN vaccines v2 ON v2.id = b2.vaccine_id
      LEFT JOIN bottle_discards bd ON bd.id = n.entity_id AND n.entity_table = 'bottle_discards'
      LEFT JOIN batch_room_entries bre3 ON bre3.id = bd.batch_entry_id
      LEFT JOIN batches b3 ON b3.id = bre3.batch_id
      LEFT JOIN vaccines v3 ON v3.id = b3.vaccine_id
      WHERE ${whereClause}
    `;

    const dataValues = [...values, page_size, offset];

    const [dataResult, countResult] = await Promise.all([
      this.pool.query<DbRowWithDescription>(
        `SELECT
          n.id, n.user_id, n.event_type, n.entity_id, n.entity_table,
          n.source_vaccine_room_id, n.is_read, n.read_at, n.created_at,
          ${descriptionExpr} AS description
        ${baseQuery}
        ORDER BY n.created_at DESC
        LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count ${baseQuery}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    const data = dataResult.rows.map((row) => ({
      ...toEntity(row),
      description: row.description,
    }));

    return { data, meta: buildMeta(page, page_size, total) };
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const { rows } = await this.pool.query<DbRow>(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${COLUMNS}`,
      [id, userId],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
  }

  async findActiveSubscribers(
    vaccineRoomId: string,
    eventType: 'bottle_opening' | 'bottle_discard',
  ): Promise<string[]> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `WITH
        room_location AS (
          SELECT location_id FROM vaccine_rooms WHERE id = $1
        ),
        event_config AS (
          SELECT id, is_enabled FROM notification_event_configs WHERE event_type = $2
        ),
        associated_users AS (
          SELECT ml.user_id
          FROM manager_locations ml
          JOIN room_location rl ON rl.location_id = ml.location_id
          WHERE ml.is_deleted = FALSE
          UNION
          SELECT tr.user_id
          FROM technician_rooms tr
          WHERE tr.vaccine_room_id = $1 AND tr.is_deleted = FALSE
        )
      SELECT au.user_id
      FROM associated_users au
      CROSS JOIN event_config ec
      LEFT JOIN notification_location_overrides nlo
        ON nlo.event_config_id = ec.id
        AND nlo.location_id = (SELECT location_id FROM room_location)
      WHERE COALESCE(nlo.is_enabled, ec.is_enabled) = TRUE`,
      [vaccineRoomId, eventType],
    );
    return rows.map((r) => r.user_id);
  }
}
