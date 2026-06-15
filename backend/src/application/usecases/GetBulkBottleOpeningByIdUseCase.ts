import { BulkBottleOpening } from '@domain/entities/BulkBottleOpening';
import { IBulkBottleOpeningRepository } from '@domain/repositories/IBulkBottleOpeningRepository';
import { NotFoundError } from '@domain/errors';

export class GetBulkBottleOpeningByIdUseCase {
  constructor(private readonly repo: IBulkBottleOpeningRepository) {}

  async execute(id: string): Promise<BulkBottleOpening> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError('Bulk bottle opening not found');
    return record;
  }
}
