import { IBottleOpeningReasonRepository } from '@domain/repositories/IBottleOpeningReasonRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteBottleOpeningReasonUseCase {
  constructor(private readonly bottleOpeningReasonRepo: IBottleOpeningReasonRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.bottleOpeningReasonRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Bottle opening reason not found');

    await this.bottleOpeningReasonRepo.softDelete(id);
  }
}
