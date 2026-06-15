import { BottleOpening } from '@domain/entities/BottleOpening';
import { IBottleOpeningRepository, ListBottleOpeningsInput } from '@domain/repositories/IBottleOpeningRepository';
import { PaginatedResult } from '@domain/shared/Pagination';

export class ListBottleOpeningsUseCase {
  constructor(private readonly repo: IBottleOpeningRepository) {}

  async execute(params: ListBottleOpeningsInput): Promise<PaginatedResult<BottleOpening>> {
    return this.repo.list(params);
  }
}
