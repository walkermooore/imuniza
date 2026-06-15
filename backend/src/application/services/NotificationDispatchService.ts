import { INotificationRepository } from '@domain/repositories/INotificationRepository';
import {
  INotificationDispatchService,
  NotificationDispatchInput,
} from '@domain/services/INotificationDispatchService';

export class NotificationDispatchService implements INotificationDispatchService {
  constructor(private readonly repo: INotificationRepository) {}

  async dispatch(input: NotificationDispatchInput): Promise<void> {
    const subscribers = await this.repo.findActiveSubscribers(
      input.vaccine_room_id,
      input.event_type,
    );

    if (subscribers.length === 0) return;

    for (const userId of subscribers) {
      await this.repo.create({
        user_id: userId,
        event_type: input.event_type,
        entity_id: input.entity_id,
        entity_table: input.entity_table,
        source_vaccine_room_id: input.vaccine_room_id,
        created_by: input.created_by,
      });
    }
  }
}
