import { BatchTransfer, TransferStatus } from '@domain/entities/BatchTransfer';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBatchTransferInput = {
  source_batch_entry_id: string;
  origin_vaccine_room_id: string;
  destination_vaccine_room_id: string;
  bottle_count: number;
  expires_at: Date;
  requested_by: string;
  comment?: string;
};

export type ListBatchTransfersInput = PaginationParams & {
  status?: TransferStatus;
  origin_vaccine_room_id?: string;
  destination_vaccine_room_id?: string;
};

export interface IBatchTransferRepository {
  create(input: CreateBatchTransferInput): Promise<BatchTransfer>;
  findById(id: string): Promise<BatchTransfer | null>;
  list(params: ListBatchTransfersInput): Promise<PaginatedResult<BatchTransfer>>;
  resolve(
    id: string,
    status: TransferStatus,
    resolvedBy: string,
    destinedBatchEntryId?: string,
  ): Promise<BatchTransfer | null>;
}
