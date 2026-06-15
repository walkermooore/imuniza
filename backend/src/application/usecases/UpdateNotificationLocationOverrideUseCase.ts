import { NotificationLocationOverride } from '@domain/entities/NotificationLocationOverride';
import { INotificationLocationOverrideRepository } from '@domain/repositories/INotificationLocationOverrideRepository';

export interface UpdateNotificationLocationOverrideInput {
  id: string;
  is_enabled: boolean;
}

export class UpdateNotificationLocationOverrideUseCase {
  constructor(private readonly repo: INotificationLocationOverrideRepository) {}

  async execute(input: UpdateNotificationLocationOverrideInput): Promise<NotificationLocationOverride> {
    return this.repo.update(input.id, input.is_enabled);
  }
}
