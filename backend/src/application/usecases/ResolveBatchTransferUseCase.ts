import { BatchTransfer } from '@domain/entities/BatchTransfer';
import { IBatchTransferRepository } from '@domain/repositories/IBatchTransferRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export type ResolveBatchTransferDTO = {
  id: string;
  action: 'accept' | 'reject' | 'cancel';
  resolved_by: string;
};

export class ResolveBatchTransferUseCase {
  constructor(private readonly batchTransferRepo: IBatchTransferRepository) {}

  async execute(dto: ResolveBatchTransferDTO): Promise<BatchTransfer> {
    const transfer = await this.batchTransferRepo.findById(dto.id);
    if (!transfer) throw new NotFoundError('Batch transfer not found');

    if (dto.action === 'accept' || dto.action === 'reject') {
      if (transfer.status !== 'pending') {
        throw new ConflictError('Transfer is not pending');
      }
    }

    if (dto.action === 'cancel') {
      if (transfer.status !== 'pending' && transfer.status !== 'accepted') {
        throw new ConflictError('Transfer is not pending or accepted');
      }
    }

    const newStatus =
      dto.action === 'accept'
        ? 'accepted'
        : dto.action === 'reject'
          ? 'rejected'
          : 'cancelled';

    const resolved = await this.batchTransferRepo.resolve(dto.id, newStatus, dto.resolved_by);
    if (!resolved) throw new NotFoundError('Batch transfer not found');
    return resolved;
  }
}
