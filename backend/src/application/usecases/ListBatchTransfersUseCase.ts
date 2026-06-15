import { IBatchTransferRepository, ListBatchTransfersInput } from '@domain/repositories/IBatchTransferRepository';
import { PaginatedResult } from '@domain/shared/Pagination';
import { BatchTransfer } from '@domain/entities/BatchTransfer';

export class ListBatchTransfersUseCase {
  constructor(private readonly batchTransferRepo: IBatchTransferRepository) {}

  async execute(params: ListBatchTransfersInput): Promise<PaginatedResult<BatchTransfer>> {
    return this.batchTransferRepo.list(params);
  }
}
