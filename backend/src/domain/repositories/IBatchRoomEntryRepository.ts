import { BatchRoomEntry } from '@domain/entities/BatchRoomEntry';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBatchRoomEntryInput = {
  batch_id: string;
  vaccine_room_id: string;
  bottle_count: number;
  source_batch_entry_id?: string;
  created_by: string;
};

export type ListBatchRoomEntriesInput = PaginationParams & {
  batch_id?: string;
  vaccine_room_id?: string;
  vaccine_room_ids?: string[];
};

export interface IBatchRoomEntryRepository {
  create(input: CreateBatchRoomEntryInput): Promise<BatchRoomEntry>;
  findById(id: string): Promise<BatchRoomEntry | null>;
  list(params: ListBatchRoomEntriesInput): Promise<PaginatedResult<BatchRoomEntry>>;
  softDelete(id: string): Promise<void>;
}
