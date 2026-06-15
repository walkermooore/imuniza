import { Vaccine } from '@domain/entities/Vaccine';
import { IVaccineRepository } from '@domain/repositories/IVaccineRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListVaccinesUseCase {
  constructor(private readonly vaccineRepo: IVaccineRepository) {}

  async execute(params: PaginationParams): Promise<PaginatedResult<Vaccine>> {
    return this.vaccineRepo.list(params);
  }
}
