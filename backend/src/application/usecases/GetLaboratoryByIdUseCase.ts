import { Laboratory } from '@domain/entities/Laboratory';
import { ILaboratoryRepository } from '@domain/repositories/ILaboratoryRepository';
import { NotFoundError } from '@domain/errors';

export class GetLaboratoryByIdUseCase {
  constructor(private readonly laboratoryRepo: ILaboratoryRepository) {}

  async execute(id: string): Promise<Laboratory> {
    const laboratory = await this.laboratoryRepo.findById(id);
    if (!laboratory) throw new NotFoundError('Laboratory not found');
    return laboratory;
  }
}
