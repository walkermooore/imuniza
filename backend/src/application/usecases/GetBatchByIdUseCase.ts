import { Batch } from '@domain/entities/Batch';
import { IBatchRepository } from '@domain/repositories/IBatchRepository';
import { NotFoundError } from '@domain/errors';

export class GetBatchByIdUseCase {
  constructor(private readonly batchRepo: IBatchRepository) {}

  async execute(id: string): Promise<Batch> {
    const batch = await this.batchRepo.findById(id);
    if (!batch || batch.is_deleted) throw new NotFoundError('Batch not found');
    return batch;
  }
}
