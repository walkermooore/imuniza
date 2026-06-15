import { Pool } from 'pg';
import { SystemParameter } from '@domain/entities/SystemParameter';
import { ISystemParameterRepository } from '@domain/repositories/ISystemParameterRepository';
import { NotFoundError } from '@domain/errors';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

interface DbRow {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_by: string | null;
  updated_at: Date | null;
}

function toEntity(row: DbRow): SystemParameter {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = 'id, key, value, description, updated_by, updated_at';

export class PgSystemParameterRepository implements ISystemParameterRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(search?: string): Promise<SystemParameter[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['key', 'value', 'description']);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${COLUMNS} FROM system_parameters ${whereClause} ORDER BY key ASC`,
      values,
    );
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<SystemParameter | null> {
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${COLUMNS} FROM system_parameters WHERE id = $1`,
      [id],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByKey(key: string): Promise<SystemParameter | null> {
    const { rows } = await this.pool.query<DbRow>(
      `SELECT ${COLUMNS} FROM system_parameters WHERE key = $1`,
      [key],
    );
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async update(id: string, value: string, updatedBy: string): Promise<SystemParameter> {
    const { rows } = await this.pool.query<DbRow>(
      `UPDATE system_parameters
       SET value = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, value, updatedBy],
    );
    if (!rows[0]) throw new NotFoundError('SystemParameter not found');
    return toEntity(rows[0]);
  }
}
