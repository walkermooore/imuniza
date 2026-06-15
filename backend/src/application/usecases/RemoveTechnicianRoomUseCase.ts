import { ITechnicianRoomRepository } from '@domain/repositories/ITechnicianRoomRepository';
import { NotFoundError } from '@domain/errors';

export class RemoveTechnicianRoomUseCase {
  constructor(private readonly technicianRoomRepo: ITechnicianRoomRepository) {}

  async execute(id: string): Promise<void> {
    const record = await this.technicianRoomRepo.findById(id);
    if (!record) throw new NotFoundError('Technician room not found');

    await this.technicianRoomRepo.softDelete(id);
  }
}
