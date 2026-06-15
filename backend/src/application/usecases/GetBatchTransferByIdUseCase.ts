import { BatchTransfer } from '@domain/entities/BatchTransfer';
import { IBatchTransferRepository } from '@domain/repositories/IBatchTransferRepository';
import { NotFoundError } from '@domain/errors';

export class GetBatchTransferByIdUseCase {
  constructor(private readonly batchTransferRepo: IBatchTransferRepository) {}

  async execute(id: string): Promise<BatchTransfer> {
    const transfer = await this.batchTransferRepo.findById(id);
    if (!transfer) throw new NotFoundError('Batch transfer not found');
    return transfer;
  }
}
