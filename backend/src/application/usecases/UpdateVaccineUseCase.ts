import { Vaccine } from '@domain/entities/Vaccine';
import { IVaccineRepository, UpdateVaccineInput } from '@domain/repositories/IVaccineRepository';
import { ILaboratoryRepository } from '@domain/repositories/ILaboratoryRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export class UpdateVaccineUseCase {
  constructor(
    private readonly vaccineRepo: IVaccineRepository,
    private readonly laboratoryRepo: ILaboratoryRepository,
  ) {}

  async execute(id: string, input: UpdateVaccineInput, updatedBy: string): Promise<Vaccine> {
    const existing = await this.vaccineRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Vaccine not found');

    if (input.laboratory_id) {
      const laboratory = await this.laboratoryRepo.findById(input.laboratory_id);
      if (!laboratory || laboratory.is_deleted) {
        throw new ConflictError('Laboratory not found');
      }
    }

    const updated = await this.vaccineRepo.update(id, { ...input, updated_by: updatedBy });
    if (!updated) throw new NotFoundError('Vaccine not found');
    return updated;
  }
}
