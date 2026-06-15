import { Laboratory } from '@domain/entities/Laboratory';
import { ILaboratoryRepository, UpdateLaboratoryInput } from '@domain/repositories/ILaboratoryRepository';
import { NotFoundError } from '@domain/errors';

export class UpdateLaboratoryUseCase {
  constructor(private readonly laboratoryRepo: ILaboratoryRepository) {}

  async execute(id: string, input: UpdateLaboratoryInput, updatedBy: string): Promise<Laboratory> {
    const existing = await this.laboratoryRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Laboratory not found');

    const updated = await this.laboratoryRepo.update(id, { ...input, updated_by: updatedBy });
    if (!updated) throw new NotFoundError('Laboratory not found');
    return updated;
  }
}
