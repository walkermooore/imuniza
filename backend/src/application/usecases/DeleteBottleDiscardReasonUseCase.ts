import { IBottleDiscardReasonRepository } from '@domain/repositories/IBottleDiscardReasonRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteBottleDiscardReasonUseCase {
  constructor(private readonly bottleDiscardReasonRepo: IBottleDiscardReasonRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.bottleDiscardReasonRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Bottle discard reason not found');

    await this.bottleDiscardReasonRepo.softDelete(id);
  }
}
