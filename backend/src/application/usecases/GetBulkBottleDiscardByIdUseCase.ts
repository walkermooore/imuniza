import { BulkBottleDiscard } from '@domain/entities/BulkBottleDiscard';
import { IBulkBottleDiscardRepository } from '@domain/repositories/IBulkBottleDiscardRepository';
import { NotFoundError } from '@domain/errors';

export class GetBulkBottleDiscardByIdUseCase {
  constructor(private readonly repo: IBulkBottleDiscardRepository) {}

  async execute(id: string): Promise<BulkBottleDiscard> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError('Bulk bottle discard not found');
    return record;
  }
}
