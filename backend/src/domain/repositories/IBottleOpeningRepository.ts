import { BottleOpening } from '@domain/entities/BottleOpening';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBottleOpeningInput = {
  batch_entry_id: string;
  vaccine_room_id: string;
  opened_at: Date;
  comment?: string;
  opening_reason_id?: string;
  alert_triggered: boolean;
  bulk_opening_id?: string;
  created_by: string;
};

export type ListBottleOpeningsInput = PaginationParams & {
  vaccine_room_id?: string;
  batch_entry_id?: string;
};

export interface IBottleOpeningRepository {
  create(input: CreateBottleOpeningInput): Promise<BottleOpening>;
  findById(id: string): Promise<BottleOpening | null>;
  list(params: ListBottleOpeningsInput): Promise<PaginatedResult<BottleOpening>>;
  cancel(id: string, cancelledBy: string): Promise<BottleOpening | null>;
}
