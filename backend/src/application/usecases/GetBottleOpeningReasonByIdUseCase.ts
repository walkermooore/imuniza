import { BottleOpeningReason } from '@domain/entities/BottleOpeningReason';
import { IBottleOpeningReasonRepository } from '@domain/repositories/IBottleOpeningReasonRepository';
import { NotFoundError } from '@domain/errors';

export class GetBottleOpeningReasonByIdUseCase {
  constructor(private readonly bottleOpeningReasonRepo: IBottleOpeningReasonRepository) {}

  async execute(id: string): Promise<BottleOpeningReason> {
    const reason = await this.bottleOpeningReasonRepo.findById(id);
    if (!reason) throw new NotFoundError('Bottle opening reason not found');
    return reason;
  }
}
