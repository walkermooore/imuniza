import { BottleDiscard } from '@domain/entities/BottleDiscard';
import { IBottleDiscardRepository, ListBottleDiscardsInput } from '@domain/repositories/IBottleDiscardRepository';
import { PaginatedResult } from '@domain/shared/Pagination';

export class ListBottleDiscardsUseCase {
  constructor(private readonly repo: IBottleDiscardRepository) {}

  async execute(params: ListBottleDiscardsInput): Promise<PaginatedResult<BottleDiscard>> {
    return this.repo.list(params);
  }
}
