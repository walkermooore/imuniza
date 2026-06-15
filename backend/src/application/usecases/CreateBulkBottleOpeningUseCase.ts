import { BulkBottleOpening } from '@domain/entities/BulkBottleOpening';
import { IBulkBottleOpeningRepository } from '@domain/repositories/IBulkBottleOpeningRepository';
import { INotificationDispatchService } from '@domain/services/INotificationDispatchService';

export type CreateBulkBottleOpeningDTO = {
  batch_entry_id: string;
  vaccine_room_id: string;
  opened_at: string;
  quantity: number;
  comment?: string;
  opening_reason_id?: string;
  alert_triggered: boolean;
  created_by: string;
};

export class CreateBulkBottleOpeningUseCase {
  constructor(
    private readonly repo: IBulkBottleOpeningRepository,
    private readonly notificationDispatch?: INotificationDispatchService,
  ) {}

  async execute(dto: CreateBulkBottleOpeningDTO): Promise<BulkBottleOpening> {
    const result = await this.repo.create({
      batch_entry_id: dto.batch_entry_id,
      vaccine_room_id: dto.vaccine_room_id,
      opened_at: new Date(dto.opened_at),
      quantity: dto.quantity,
      comment: dto.comment,
      opening_reason_id: dto.opening_reason_id,
      alert_triggered: dto.alert_triggered,
      created_by: dto.created_by,
    });

    if (this.notificationDispatch) {
      try {
        await this.notificationDispatch.dispatch({
          vaccine_room_id: result.vaccine_room_id,
          event_type: 'bottle_opening',
          entity_id: result.id,
          entity_table: 'bulk_bottle_openings',
          created_by: dto.created_by,
        });
      } catch (err) {
        console.error('[CreateBulkBottleOpeningUseCase] notification dispatch failed:', err);
      }
    }

    return result;
  }
}
