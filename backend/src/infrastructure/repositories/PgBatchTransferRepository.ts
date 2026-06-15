import { Pool } from 'pg';
import { BatchTransfer, TransferStatus } from '@domain/entities/BatchTransfer';
import {
  IBatchTransferRepository,
  CreateBatchTransferInput,
  ListBatchTransfersInput,
} from '@domain/repositories/IBatchTransferRepository';
import { PaginatedResult, buildMeta } from '@domain/shared/Pagination';
import { addTextSearchCondition } from '@infrastructure/repositories/utils/search';

const BATCH_TRANSFER_COLUMNS =
  'id, source_batch_entry_id, destined_batch_entry_id, origin_vaccine_room_id, destination_vaccine_room_id, bottle_count, status, expires_at, requested_by, requested_at, resolved_by, resolved_at, comment, created_at';

export class PgBatchTransferRepository implements IBatchTransferRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBatchTransferInput): Promise<BatchTransfer> {
    const { rows } = await this.pool.query<BatchTransfer>(
      `INSERT INTO batch_transfers
         (source_batch_entry_id, origin_vaccine_room_id, destination_vaccine_room_id, bottle_count, expires_at, requested_by, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${BATCH_TRANSFER_COLUMNS}`,
      [
        input.source_batch_entry_id,
        input.origin_vaccine_room_id,
        input.destination_vaccine_room_id,
        input.bottle_count,
        input.expires_at,
        input.requested_by,
        input.comment ?? null,
      ],
    );
    return rows[0];
  }

  async findById(id: string): Promise<BatchTransfer | null> {
    const { rows } = await this.pool.query<BatchTransfer>(
      `SELECT ${BATCH_TRANSFER_COLUMNS} FROM batch_transfers WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(params: ListBatchTransfersInput): Promise<PaginatedResult<BatchTransfer>> {
    const { page, page_size, status, origin_vaccine_room_id, destination_vaccine_room_id, search } = params;
    const offset = (page - 1) * page_size;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    if (origin_vaccine_room_id) {
      conditions.push(`origin_vaccine_room_id = $${values.length + 1}`);
      values.push(origin_vaccine_room_id);
    }
    if (destination_vaccine_room_id) {
      conditions.push(`destination_vaccine_room_id = $${values.length + 1}`);
      values.push(destination_vaccine_room_id);
    }
    addTextSearchCondition(conditions, values, search, ['comment']);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataValues = [...values, page_size, offset];
    const countValues = [...values];

    const [{ rows }, countResult] = await Promise.all([
      this.pool.query<BatchTransfer>(
        `SELECT ${BATCH_TRANSFER_COLUMNS} FROM batch_transfers
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues,
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM batch_transfers ${whereClause}`,
        countValues,
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return { data: rows, meta: buildMeta(page, page_size, total) };
  }

  async resolve(
    id: string,
    status: TransferStatus,
    resolvedBy: string,
    destinedBatchEntryId?: string,
  ): Promise<BatchTransfer | null> {
    const { rows } = await this.pool.query<BatchTransfer>(
      `UPDATE batch_transfers
       SET status = $2, resolved_by = $3, resolved_at = NOW(), destined_batch_entry_id = $4
       WHERE id = $1
       RETURNING ${BATCH_TRANSFER_COLUMNS}`,
      [id, status, resolvedBy, destinedBatchEntryId ?? null],
    );
    return rows[0] ?? null;
  }
}
