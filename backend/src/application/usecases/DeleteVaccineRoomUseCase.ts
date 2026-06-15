import { IVaccineRoomRepository } from '@domain/repositories/IVaccineRoomRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteVaccineRoomUseCase {
  constructor(private readonly vaccineRoomRepo: IVaccineRoomRepository) {}

  async execute(id: string, deletedBy: string): Promise<void> {
    const existing = await this.vaccineRoomRepo.findById(id);
    if (!existing) throw new NotFoundError('Vaccine room not found');

    await this.vaccineRoomRepo.softDelete(id, deletedBy);
  }
}
