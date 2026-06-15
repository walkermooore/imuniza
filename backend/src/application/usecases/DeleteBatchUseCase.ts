import { IBatchRepository } from '@domain/repositories/IBatchRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteBatchUseCase {
  constructor(private readonly batchRepo: IBatchRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.batchRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Batch not found');

    await this.batchRepo.softDelete(id);
  }
}
