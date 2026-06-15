import { BottleOpeningReason } from '@domain/entities/BottleOpeningReason';
import { IBottleOpeningReasonRepository, UpdateBottleOpeningReasonInput } from '@domain/repositories/IBottleOpeningReasonRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export class UpdateBottleOpeningReasonUseCase {
  constructor(private readonly bottleOpeningReasonRepo: IBottleOpeningReasonRepository) {}

  async execute(id: string, input: UpdateBottleOpeningReasonInput, updatedBy: string): Promise<BottleOpeningReason> {
    const existing = await this.bottleOpeningReasonRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Bottle opening reason not found');

    if (input.is_default) {
      const existingDefault = await this.bottleOpeningReasonRepo.findDefault();
      if (existingDefault && existingDefault.id !== id) {
        throw new ConflictError('Another default reason already exists');
      }
    }

    const updated = await this.bottleOpeningReasonRepo.update(id, { ...input, updated_by: updatedBy });
    if (!updated) throw new NotFoundError('Bottle opening reason not found');
    return updated;
  }
}
