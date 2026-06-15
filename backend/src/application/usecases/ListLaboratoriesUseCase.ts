import { Laboratory } from '@domain/entities/Laboratory';
import { ILaboratoryRepository } from '@domain/repositories/ILaboratoryRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListLaboratoriesUseCase {
  constructor(private readonly laboratoryRepo: ILaboratoryRepository) {}

  async execute(params: PaginationParams): Promise<PaginatedResult<Laboratory>> {
    return this.laboratoryRepo.list(params);
  }
}
