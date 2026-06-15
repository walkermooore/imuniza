import { VaccineRoom } from '@domain/entities/VaccineRoom';
import { IVaccineRoomRepository } from '@domain/repositories/IVaccineRoomRepository';
import { NotFoundError } from '@domain/errors';

export class GetVaccineRoomByIdUseCase {
  constructor(private readonly vaccineRoomRepo: IVaccineRoomRepository) {}

  async execute(id: string): Promise<VaccineRoom> {
    const room = await this.vaccineRoomRepo.findById(id);
    if (!room) throw new NotFoundError('Vaccine room not found');
    return room;
  }
}
