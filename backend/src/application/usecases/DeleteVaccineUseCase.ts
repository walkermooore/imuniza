import { IVaccineRepository } from '@domain/repositories/IVaccineRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteVaccineUseCase {
  constructor(private readonly vaccineRepo: IVaccineRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.vaccineRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Vaccine not found');

    await this.vaccineRepo.softDelete(id);
  }
}
