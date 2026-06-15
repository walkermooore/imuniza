import { BottleDiscardReason } from '@domain/entities/BottleDiscardReason';
import { IBottleDiscardReasonRepository } from '@domain/repositories/IBottleDiscardReasonRepository';
import { NotFoundError } from '@domain/errors';

export class GetBottleDiscardReasonByIdUseCase {
  constructor(private readonly bottleDiscardReasonRepo: IBottleDiscardReasonRepository) {}

  async execute(id: string): Promise<BottleDiscardReason> {
    const reason = await this.bottleDiscardReasonRepo.findById(id);
    if (!reason) throw new NotFoundError('Bottle discard reason not found');
    return reason;
  }
}
