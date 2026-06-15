import { BulkBottleDiscard, BulkDiscardMode } from '@domain/entities/BulkBottleDiscard';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBulkBottleDiscardInput = {
  batch_entry_id: string;
  vaccine_room_id: string;
  mode: BulkDiscardMode;
  discarded_at: Date;
  discard_reason_id: string;
  quantity: number;
  comment?: string;
  created_by: string;
};

export type ListBulkBottleDiscardsInput = PaginationParams & {
  vaccine_room_id?: string;
  batch_entry_id?: string;
};

export interface IBulkBottleDiscardRepository {
  create(input: CreateBulkBottleDiscardInput): Promise<BulkBottleDiscard>;
  findById(id: string): Promise<BulkBottleDiscard | null>;
  list(params: ListBulkBottleDiscardsInput): Promise<PaginatedResult<BulkBottleDiscard>>;
}
