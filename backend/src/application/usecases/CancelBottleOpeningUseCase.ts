import { BottleOpening } from '@domain/entities/BottleOpening';
import { IBottleOpeningRepository } from '@domain/repositories/IBottleOpeningRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export class CancelBottleOpeningUseCase {
  constructor(private readonly repo: IBottleOpeningRepository) {}

  async execute(id: string, cancelledBy: string): Promise<BottleOpening> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError('Bottle opening not found');
    if (record.is_cancelled) throw new ConflictError('Opening is already cancelled');

    const updated = await this.repo.cancel(id, cancelledBy);
    if (!updated) throw new NotFoundError('Bottle opening not found');
    return updated;
  }
}
