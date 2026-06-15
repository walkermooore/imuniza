import { Pool } from 'pg';
import { NotificationLocationOverride } from '@domain/entities/NotificationLocationOverride';
import {
  INotificationLocationOverrideRepository,
  CreateNotificationLocationOverrideInput,
} from '@domain/repositories/INotificationLocationOverrideRepository';
import { NotFoundError } from '@domain/errors';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

interface DbRow {
  id: string;
  event_config_id: string;
  location_id: string;
  is_enabled: boolean;
  created_by: string;
  created_at: Date;
}

function toEntity(row: DbRow): NotificationLocationOverride {
  return {
    id: row.id,
    event_config_id: row.event_config_id,
    location_id: row.location_id,
    is_enabled: row.is_enabled,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

const COLUMNS = 'id, event_config_id, location_id, is_enabled, created_by, created_at';
const LIST_COLUMNS = 'nlo.id, nlo.event_config_id, nlo.location_id, nlo.is_enabled, nlo.created_by, nlo.created_at';

export class PgNotificationLocationOverrideRepository implements INotificationLocationOverrideRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(search?: string): Promise<NotificationLocationOverride[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['nec.label', 'l.name']);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${LIST_COLUMNS}
       FROM notification_location_overrides nlo
       JOIN notification_event_configs nec ON nec.id = nlo.event_config_id
       JOIN locations l ON l.id = nlo.location_id
       ${whereClause}
       ORDER BY nlo.created_at DESC`,
      values,
    );
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<NotificationLocationOverride | null> {
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${COLUMNS} FROM notification_location_overrides WHERE id = $1`,
      [id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByLocationAndEventConfig(
    locationId: string,
    eventConfigId: string,
  ): Promise<NotificationLocationOverride | null> {
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${COLUMNS} FROM notification_location_overrides
       WHERE location_id = $1 AND event_config_id = $2`,
      [locationId, eventConfigId],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(input: CreateNotificationLocationOverrideInput): Promise<NotificationLocationOverride> {
    const { rows } = await this.pool.query<DbRow>(
      `INSERT INTO notification_location_overrides (id, event_config_id, location_id, is_enabled, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [input.event_config_id, input.location_id, input.is_enabled, input.created_by],
    );
    return toEntity(rows[0]);
  }

  async update(id: string, isEnabled: boolean): Promise<NotificationLocationOverride> {
    const { rows } = await this.pool.query<DbRow>(
      `UPDATE notification_location_overrides
       SET is_enabled = $2
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, isEnabled],
    );
    if (!rows[0]) throw new NotFoundError('NotificationLocationOverride not found');
    return toEntity(rows[0]);
  }

  async delete(id: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM notification_location_overrides WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) throw new NotFoundError('NotificationLocationOverride not found');
  }
}
