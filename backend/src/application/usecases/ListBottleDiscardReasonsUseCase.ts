import { BottleDiscardReason } from '@domain/entities/BottleDiscardReason';
import { IBottleDiscardReasonRepository } from '@domain/repositories/IBottleDiscardReasonRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListBottleDiscardReasonsUseCase {
  constructor(private readonly bottleDiscardReasonRepo: IBottleDiscardReasonRepository) {}

  async execute(params: PaginationParams): Promise<PaginatedResult<BottleDiscardReason>> {
    return this.bottleDiscardReasonRepo.list(params);
  }
}
