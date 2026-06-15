import { Location } from '@domain/entities/Location';
import { ILocationRepository } from '@domain/repositories/ILocationRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListLocationsUseCase {
  constructor(private readonly locationRepo: ILocationRepository) {}

  async execute(params: PaginationParams): Promise<PaginatedResult<Location>> {
    return this.locationRepo.list(params);
  }
}
