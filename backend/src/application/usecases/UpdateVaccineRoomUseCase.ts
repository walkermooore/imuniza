import { VaccineRoom } from '@domain/entities/VaccineRoom';
import { IVaccineRoomRepository, UpdateVaccineRoomInput } from '@domain/repositories/IVaccineRoomRepository';
import { NotFoundError } from '@domain/errors';

export class UpdateVaccineRoomUseCase {
  constructor(private readonly vaccineRoomRepo: IVaccineRoomRepository) {}

  async execute(id: string, input: UpdateVaccineRoomInput, updatedBy: string): Promise<VaccineRoom> {
    const existing = await this.vaccineRoomRepo.findById(id);
    if (!existing) throw new NotFoundError('Vaccine room not found');

    const updated = await this.vaccineRoomRepo.update(id, { ...input, updated_by: updatedBy });
    if (!updated) throw new NotFoundError('Vaccine room not found');
    return updated;
  }
}
