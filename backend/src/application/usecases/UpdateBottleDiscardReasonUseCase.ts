import { BottleDiscardReason } from '@domain/entities/BottleDiscardReason';
import { IBottleDiscardReasonRepository, UpdateBottleDiscardReasonInput } from '@domain/repositories/IBottleDiscardReasonRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export class UpdateBottleDiscardReasonUseCase {
  constructor(private readonly bottleDiscardReasonRepo: IBottleDiscardReasonRepository) {}

  async execute(id: string, input: UpdateBottleDiscardReasonInput, updatedBy: string): Promise<BottleDiscardReason> {
    const existing = await this.bottleDiscardReasonRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Bottle discard reason not found');

    if (input.is_default) {
      const existingDefault = await this.bottleDiscardReasonRepo.findDefault();
      if (existingDefault && existingDefault.id !== id) {
        throw new ConflictError('Another default reason already exists');
      }
    }

    const updated = await this.bottleDiscardReasonRepo.update(id, { ...input, updated_by: updatedBy });
    if (!updated) throw new NotFoundError('Bottle discard reason not found');
    return updated;
  }
}
