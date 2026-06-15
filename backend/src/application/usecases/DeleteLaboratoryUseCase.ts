import { ILaboratoryRepository } from '@domain/repositories/ILaboratoryRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteLaboratoryUseCase {
  constructor(private readonly laboratoryRepo: ILaboratoryRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.laboratoryRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Laboratory not found');

    await this.laboratoryRepo.softDelete(id);
  }
}
