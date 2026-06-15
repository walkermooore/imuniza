import { IManagerLocationRepository, ListManagerLocationsInput } from '@domain/repositories/IManagerLocationRepository';
import { PaginatedResult } from '@domain/shared/Pagination';
import { ManagerLocation } from '@domain/entities/ManagerLocation';

export class ListManagerLocationsUseCase {
  constructor(private readonly managerLocationRepo: IManagerLocationRepository) {}

  async execute(params: ListManagerLocationsInput): Promise<PaginatedResult<ManagerLocation>> {
    return this.managerLocationRepo.list(params);
  }
}
