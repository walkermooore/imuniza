import { Vaccine } from '@domain/entities/Vaccine';
import { IVaccineRepository } from '@domain/repositories/IVaccineRepository';
import { NotFoundError } from '@domain/errors';

export class GetVaccineByIdUseCase {
  constructor(private readonly vaccineRepo: IVaccineRepository) {}

  async execute(id: string): Promise<Vaccine> {
    const vaccine = await this.vaccineRepo.findById(id);
    if (!vaccine) throw new NotFoundError('Vaccine not found');
    return vaccine;
  }
}
