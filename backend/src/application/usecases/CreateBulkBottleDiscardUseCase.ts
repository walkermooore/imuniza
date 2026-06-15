import { BulkBottleDiscard, BulkDiscardMode } from '@domain/entities/BulkBottleDiscard';
import { IBulkBottleDiscardRepository } from '@domain/repositories/IBulkBottleDiscardRepository';

export type CreateBulkBottleDiscardDTO = {
  batch_entry_id: string;
  vaccine_room_id: string;
  mode: BulkDiscardMode;
  discarded_at: string;
  discard_reason_id: string;
  quantity: number;
  comment?: string;
  created_by: string;
};

export class CreateBulkBottleDiscardUseCase {
  constructor(private readonly repo: IBulkBottleDiscardRepository) {}

  async execute(dto: CreateBulkBottleDiscardDTO): Promise<BulkBottleDiscard> {
    return this.repo.create({
      batch_entry_id: dto.batch_entry_id,
      vaccine_room_id: dto.vaccine_room_id,
      mode: dto.mode,
      discarded_at: new Date(dto.discarded_at),
      discard_reason_id: dto.discard_reason_id,
      quantity: dto.quantity,
      comment: dto.comment,
      created_by: dto.created_by,
    });
  }
}
