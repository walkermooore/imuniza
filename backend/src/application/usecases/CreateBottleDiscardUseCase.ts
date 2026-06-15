import { BottleDiscard } from '@domain/entities/BottleDiscard';
import { IBottleDiscardRepository } from '@domain/repositories/IBottleDiscardRepository';
import { INotificationDispatchService } from '@domain/services/INotificationDispatchService';

export type CreateBottleDiscardDTO = {
  batch_entry_id: string;
  bottle_opening_id?: string;
  discarded_at: string;
  discard_reason_id: string;
  remaining_doses?: number;
  comment?: string;
  bulk_discard_id?: string;
  vaccine_room_id?: string;
  created_by: string;
};

export class CreateBottleDiscardUseCase {
  constructor(
    private readonly repo: IBottleDiscardRepository,
    private readonly notificationDispatch?: INotificationDispatchService,
  ) {}

  async execute(dto: CreateBottleDiscardDTO): Promise<BottleDiscard> {
    const result = await this.repo.create({
      batch_entry_id: dto.batch_entry_id,
      bottle_opening_id: dto.bottle_opening_id,
      discarded_at: new Date(dto.discarded_at),
      discard_reason_id: dto.discard_reason_id,
      remaining_doses: dto.remaining_doses,
      comment: dto.comment,
      bulk_discard_id: dto.bulk_discard_id,
      created_by: dto.created_by,
    });

    if (this.notificationDispatch && dto.vaccine_room_id) {
      try {
        await this.notificationDispatch.dispatch({
          vaccine_room_id: dto.vaccine_room_id,
          event_type: 'bottle_discard',
          entity_id: result.id,
          entity_table: 'bottle_discards',
          created_by: dto.created_by,
        });
      } catch (err) {
        console.error('[CreateBottleDiscardUseCase] notification dispatch failed:', err);
      }
    }

    return result;
  }
}
