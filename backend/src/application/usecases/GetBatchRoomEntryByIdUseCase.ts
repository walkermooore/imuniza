import { BatchRoomEntry } from '@domain/entities/BatchRoomEntry';
import { IBatchRoomEntryRepository } from '@domain/repositories/IBatchRoomEntryRepository';
import { NotFoundError } from '@domain/errors';

export class GetBatchRoomEntryByIdUseCase {
  constructor(private readonly batchRoomEntryRepo: IBatchRoomEntryRepository) {}

  async execute(id: string): Promise<BatchRoomEntry> {
    const entry = await this.batchRoomEntryRepo.findById(id);
    if (!entry || entry.is_deleted) throw new NotFoundError('Batch room entry not found');
    return entry;
  }
}
