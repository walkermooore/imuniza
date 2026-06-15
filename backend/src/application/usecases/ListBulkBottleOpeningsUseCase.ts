import { BulkBottleOpening } from '@domain/entities/BulkBottleOpening';
import { IBulkBottleOpeningRepository, ListBulkBottleOpeningsInput } from '@domain/repositories/IBulkBottleOpeningRepository';
import { PaginatedResult } from '@domain/shared/Pagination';

export class ListBulkBottleOpeningsUseCase {
  constructor(private readonly repo: IBulkBottleOpeningRepository) {}

  async execute(params: ListBulkBottleOpeningsInput): Promise<PaginatedResult<BulkBottleOpening>> {
    return this.repo.list(params);
  }
}
