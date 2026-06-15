import { Vaccine } from '@domain/entities/Vaccine';
import { IVaccineRepository } from '@domain/repositories/IVaccineRepository';
import { ILaboratoryRepository } from '@domain/repositories/ILaboratoryRepository';
import { ConflictError } from '@domain/errors';

export type CreateVaccineDTO = {
  name: string;
  laboratory_id: string;
  createdBy?: string;
};

export class CreateVaccineUseCase {
  constructor(
    private readonly vaccineRepo: IVaccineRepository,
    private readonly laboratoryRepo: ILaboratoryRepository,
  ) {}

  async execute(dto: CreateVaccineDTO): Promise<Vaccine> {
    const laboratory = await this.laboratoryRepo.findById(dto.laboratory_id);
    if (!laboratory || laboratory.is_deleted) {
      throw new ConflictError('Laboratory not found');
    }

    return this.vaccineRepo.create({ name: dto.name, laboratory_id: dto.laboratory_id, created_by: dto.createdBy });
  }
}
