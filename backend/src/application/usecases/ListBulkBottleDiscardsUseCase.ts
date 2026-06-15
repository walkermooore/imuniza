import { BulkBottleDiscard } from '@domain/entities/BulkBottleDiscard';
import { IBulkBottleDiscardRepository, ListBulkBottleDiscardsInput } from '@domain/repositories/IBulkBottleDiscardRepository';
import { PaginatedResult } from '@domain/shared/Pagination';

export class ListBulkBottleDiscardsUseCase {
  constructor(private readonly repo: IBulkBottleDiscardRepository) {}

  async execute(params: ListBulkBottleDiscardsInput): Promise<PaginatedResult<BulkBottleDiscard>> {
    return this.repo.list(params);
  }
}
