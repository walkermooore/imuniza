import { Pool } from 'pg';
import { NotificationEventConfig } from '@domain/entities/NotificationEventConfig';
import { INotificationEventConfigRepository } from '@domain/repositories/INotificationEventConfigRepository';
import { NotFoundError } from '@domain/errors';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

interface DbRow {
  id: string;
  event_type: 'bottle_opening' | 'bottle_discard';
  label: string;
  is_enabled: boolean;
  created_by: string | null;
  created_at: Date;
  updated_by: string | null;
  updated_at: Date | null;
}

function toEntity(row: DbRow): NotificationEventConfig {
  return {
    id: row.id,
    event_type: row.event_type,
    label: row.label,
    is_enabled: row.is_enabled,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  };
}

const COLUMNS = 'id, event_type, label, is_enabled, created_by, created_at, updated_by, updated_at';

export class PgNotificationEventConfigRepository implements INotificationEventConfigRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(search?: string): Promise<NotificationEventConfig[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['label', 'event_type::text']);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${COLUMNS} FROM notification_event_configs ${whereClause} ORDER BY event_type ASC`,
      values,
    );
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<NotificationEventConfig | null> {
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${COLUMNS} FROM notification_event_configs WHERE id = $1`,
      [id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async update(id: string, isEnabled: boolean, updatedBy: string): Promise<NotificationEventConfig> {
    const { rows } = await this.pool.query<DbRow>(
      `UPDATE notification_event_configs
       SET is_enabled = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, isEnabled, updatedBy],
    );
    if (!rows[0]) throw new NotFoundError('NotificationEventConfig not found');
    return toEntity(rows[0]);
  }
}
