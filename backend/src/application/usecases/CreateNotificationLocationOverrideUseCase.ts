import { NotificationLocationOverride } from '@domain/entities/NotificationLocationOverride';
import {
  INotificationLocationOverrideRepository,
  CreateNotificationLocationOverrideInput,
} from '@domain/repositories/INotificationLocationOverrideRepository';
import { ConflictError } from '@domain/errors';

export class CreateNotificationLocationOverrideUseCase {
  constructor(private readonly repo: INotificationLocationOverrideRepository) {}

  async execute(input: CreateNotificationLocationOverrideInput): Promise<NotificationLocationOverride> {
    const existing = await this.repo.findByLocationAndEventConfig(
      input.location_id,
      input.event_config_id,
    );
    if (existing) {
      throw new ConflictError('Override already exists for this location and event type');
    }
    return this.repo.create(input);
  }
}
