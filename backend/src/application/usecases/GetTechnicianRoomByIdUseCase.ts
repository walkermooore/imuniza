import { TechnicianRoom } from '@domain/entities/TechnicianRoom';
import { ITechnicianRoomRepository } from '@domain/repositories/ITechnicianRoomRepository';
import { NotFoundError } from '@domain/errors';

export class GetTechnicianRoomByIdUseCase {
  constructor(private readonly technicianRoomRepo: ITechnicianRoomRepository) {}

  async execute(id: string): Promise<TechnicianRoom> {
    const record = await this.technicianRoomRepo.findById(id);
    if (!record) throw new NotFoundError('Technician room not found');
    return record;
  }
}
