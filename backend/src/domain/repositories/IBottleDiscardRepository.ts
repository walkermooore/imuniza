import { BottleDiscard } from '@domain/entities/BottleDiscard';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBottleDiscardInput = {
  batch_entry_id: string;
  bottle_opening_id?: string;
  discarded_at: Date;
  discard_reason_id: string;
  remaining_doses?: number;
  comment?: string;
  bulk_discard_id?: string;
  created_by: string;
};

export type ListBottleDiscardsInput = PaginationParams & {
  vaccine_room_id?: string;
  batch_entry_id?: string;
};

export interface IBottleDiscardRepository {
  create(input: CreateBottleDiscardInput): Promise<BottleDiscard>;
  findById(id: string): Promise<BottleDiscard | null>;
  list(params: ListBottleDiscardsInput): Promise<PaginatedResult<BottleDiscard>>;
  cancel(id: string, cancelledBy: string): Promise<BottleDiscard | null>;
}
