import { BatchTransfer } from '@domain/entities/BatchTransfer';
import { IBatchTransferRepository } from '@domain/repositories/IBatchTransferRepository';

const DEFAULT_EXPIRE_MINUTES = 2880; // 48 hours

export type CreateBatchTransferDTO = {
  source_batch_entry_id: string;
  origin_vaccine_room_id: string;
  destination_vaccine_room_id: string;
  bottle_count: number;
  requested_by: string;
  comment?: string;
};

export class CreateBatchTransferUseCase {
  constructor(private readonly batchTransferRepo: IBatchTransferRepository) {}

  async execute(dto: CreateBatchTransferDTO): Promise<BatchTransfer> {
    const expires_at = new Date(Date.now() + DEFAULT_EXPIRE_MINUTES * 60 * 1000);

    return this.batchTransferRepo.create({
      source_batch_entry_id: dto.source_batch_entry_id,
      origin_vaccine_room_id: dto.origin_vaccine_room_id,
      destination_vaccine_room_id: dto.destination_vaccine_room_id,
      bottle_count: dto.bottle_count,
      expires_at,
      requested_by: dto.requested_by,
      comment: dto.comment,
    });
  }
}
