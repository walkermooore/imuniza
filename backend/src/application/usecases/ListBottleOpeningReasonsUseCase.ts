import { BottleOpeningReason } from '@domain/entities/BottleOpeningReason';
import { IBottleOpeningReasonRepository } from '@domain/repositories/IBottleOpeningReasonRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListBottleOpeningReasonsUseCase {
  constructor(private readonly bottleOpeningReasonRepo: IBottleOpeningReasonRepository) {}

  async execute(params: PaginationParams): Promise<PaginatedResult<BottleOpeningReason>> {
    return this.bottleOpeningReasonRepo.list(params);
  }
}
