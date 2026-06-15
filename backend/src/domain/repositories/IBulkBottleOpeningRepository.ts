import { BulkBottleOpening } from '@domain/entities/BulkBottleOpening';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBulkBottleOpeningInput = {
  batch_entry_id: string;
  vaccine_room_id: string;
  opened_at: Date;
  quantity: number;
  comment?: string;
  opening_reason_id?: string;
  alert_triggered: boolean;
  created_by: string;
};

export type ListBulkBottleOpeningsInput = PaginationParams & {
  vaccine_room_id?: string;
  batch_entry_id?: string;
};

export interface IBulkBottleOpeningRepository {
  create(input: CreateBulkBottleOpeningInput): Promise<BulkBottleOpening>;
  findById(id: string): Promise<BulkBottleOpening | null>;
  list(params: ListBulkBottleOpeningsInput): Promise<PaginatedResult<BulkBottleOpening>>;
}
