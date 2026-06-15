import { BottleDiscard } from '@domain/entities/BottleDiscard';
import { IBottleDiscardRepository } from '@domain/repositories/IBottleDiscardRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export class CancelBottleDiscardUseCase {
  constructor(private readonly repo: IBottleDiscardRepository) {}

  async execute(id: string, cancelledBy: string): Promise<BottleDiscard> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError('Bottle discard not found');
    if (record.is_cancelled) throw new ConflictError('Discard is already cancelled');

    const updated = await this.repo.cancel(id, cancelledBy);
    if (!updated) throw new NotFoundError('Bottle discard not found');
    return updated;
  }
}
