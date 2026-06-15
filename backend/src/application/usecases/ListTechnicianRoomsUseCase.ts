import { ITechnicianRoomRepository, ListTechnicianRoomsInput } from '@domain/repositories/ITechnicianRoomRepository';
import { PaginatedResult } from '@domain/shared/Pagination';
import { TechnicianRoom } from '@domain/entities/TechnicianRoom';

export class ListTechnicianRoomsUseCase {
  constructor(private readonly technicianRoomRepo: ITechnicianRoomRepository) {}

  async execute(params: ListTechnicianRoomsInput): Promise<PaginatedResult<TechnicianRoom>> {
    return this.technicianRoomRepo.list(params);
  }
}
