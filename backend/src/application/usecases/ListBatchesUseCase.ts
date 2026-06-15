import { Batch } from '@domain/entities/Batch';
import { IBatchRepository } from '@domain/repositories/IBatchRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListBatchesUseCase {
  constructor(private readonly batchRepo: IBatchRepository) {}

  async execute(params: PaginationParams): Promise<PaginatedResult<Batch>> {
    return this.batchRepo.list(params);
  }
}
