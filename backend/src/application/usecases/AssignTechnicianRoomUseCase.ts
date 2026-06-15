import { TechnicianRoom } from '@domain/entities/TechnicianRoom';
import { ITechnicianRoomRepository } from '@domain/repositories/ITechnicianRoomRepository';
import { ConflictError } from '@domain/errors';

export type AssignTechnicianRoomDTO = {
  user_id: string;
  vaccine_room_id: string;
  createdBy: string;
};

export class AssignTechnicianRoomUseCase {
  constructor(private readonly technicianRoomRepo: ITechnicianRoomRepository) {}

  async execute(dto: AssignTechnicianRoomDTO): Promise<TechnicianRoom> {
    const existing = await this.technicianRoomRepo.findActive(dto.user_id, dto.vaccine_room_id);
    if (existing) throw new ConflictError('Technician is already assigned to this room');

    return this.technicianRoomRepo.create({
      user_id: dto.user_id,
      vaccine_room_id: dto.vaccine_room_id,
      created_by: dto.createdBy,
    });
  }
}
