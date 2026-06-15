import { Laboratory } from '@domain/entities/Laboratory';
import { ILaboratoryRepository } from '@domain/repositories/ILaboratoryRepository';

export type CreateLaboratoryDTO = {
  name: string;
  createdBy?: string;
};

export class CreateLaboratoryUseCase {
  constructor(private readonly laboratoryRepo: ILaboratoryRepository) {}

  async execute(dto: CreateLaboratoryDTO): Promise<Laboratory> {
    return this.laboratoryRepo.create({ name: dto.name, created_by: dto.createdBy });
  }
}
