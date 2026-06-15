import { VaccineRoom } from '@domain/entities/VaccineRoom';
import { IVaccineRoomRepository } from '@domain/repositories/IVaccineRoomRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListVaccineRoomsUseCase {
  constructor(private readonly vaccineRoomRepo: IVaccineRoomRepository) {}

  async execute(
    params: PaginationParams & { location_id?: string },
  ): Promise<PaginatedResult<VaccineRoom>> {
    return this.vaccineRoomRepo.list(params);
  }
}
