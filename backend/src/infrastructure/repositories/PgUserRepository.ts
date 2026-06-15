import { Pool } from 'pg';
import { User } from '@domain/entities/User';
import {
  IUserRepository,
  CreateUserInput,
  UpdateUserInput,
} from '@domain/repositories/IUserRepository';
import { PaginationParams, PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

export class PgUserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateUserInput): Promise<Omit<User, 'password_hash'>> {
    const { rows } = await this.pool.query<Omit<User, 'password_hash'>>(
      `INSERT INTO users (name, email, role, job_title, password_hash, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, job_title, is_active, created_at, updated_at`,
      [input.name, input.email, input.role, input.job_title ?? null, input.password_hash, input.created_by ?? null],
    );
    return rows[0];
  }

  async findById(id: string): Promise<Omit<User, 'password_hash'> | null> {
    const { rows } = await this.pool.query<Omit<User, 'password_hash'>>(
      `SELECT id, name, email, role, job_title, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<User>(
      `SELECT id, name, email, role, job_title, password_hash, is_active, created_at, updated_at
       FROM users WHERE email = $1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Omit<User, 'password_hash'>>> {
    const { page, page_size, search } = params;
    const offset = (page - 1) * page_size;
    const conditions = ['is_active = true'];
    const values: unknown[] = [];

    addTextSearchCondition(conditions, values, search, ['name', 'email', 'job_title']);

    const whereClause = conditions.join(' AND ');
    const dataValues = [...values, page_size, offset];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<Omit<User, 'password_hash'>>(
        `SELECT id, name, email, role, job_title, is_active, created_at, updated_at
         FROM users WHERE ${whereClause}
         ORDER BY name
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users WHERE ${whereClause}`,
        values,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async update(
    id: string,
    input: UpdateUserInput,
  ): Promise<Omit<User, 'password_hash'> | null> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id);

    const setClause = fields
      .map(([key], i) => `${key} = $${i + 2}`)
      .join(', ');
    const values = fields.map(([, v]) => v);

    const { rows } = await this.pool.query<Omit<User, 'password_hash'>>(
      `UPDATE users
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, email, role, job_title, is_active, created_at, updated_at`,
      [id, ...values],
    );
    return rows[0] ?? null;
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
