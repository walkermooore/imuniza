import { BottleOpening } from '@domain/entities/BottleOpening';
import { IBottleOpeningRepository } from '@domain/repositories/IBottleOpeningRepository';
import { INotificationDispatchService } from '@domain/services/INotificationDispatchService';

export type CreateBottleOpeningDTO = {
  batch_entry_id: string;
  vaccine_room_id: string;
  opened_at: string;
  comment?: string;
  opening_reason_id?: string;
  alert_triggered: boolean;
  bulk_opening_id?: string;
  created_by: string;
};

export class CreateBottleOpeningUseCase {
  constructor(
    private readonly repo: IBottleOpeningRepository,
    private readonly notificationDispatch?: INotificationDispatchService,
  ) {}

  async execute(dto: CreateBottleOpeningDTO): Promise<BottleOpening> {
    const result = await this.repo.create({
      batch_entry_id: dto.batch_entry_id,
      vaccine_room_id: dto.vaccine_room_id,
      opened_at: new Date(dto.opened_at),
      comment: dto.comment,
      opening_reason_id: dto.opening_reason_id,
      alert_triggered: dto.alert_triggered,
      bulk_opening_id: dto.bulk_opening_id,
      created_by: dto.created_by,
    });

    if (this.notificationDispatch) {
      try {
        await this.notificationDispatch.dispatch({
          vaccine_room_id: result.vaccine_room_id,
          event_type: 'bottle_opening',
          entity_id: result.id,
          entity_table: 'bottle_openings',
          created_by: dto.created_by,
        });
      } catch (err) {
        console.error('[CreateBottleOpeningUseCase] notification dispatch failed:', err);
      }
    }

    return result;
  }
}
