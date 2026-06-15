import { NotificationEventConfig } from '@domain/entities/NotificationEventConfig';
import { INotificationEventConfigRepository } from '@domain/repositories/INotificationEventConfigRepository';

export interface UpdateNotificationEventConfigInput {
  id: string;
  is_enabled: boolean;
  updated_by: string;
}

export class UpdateNotificationEventConfigUseCase {
  constructor(private readonly repo: INotificationEventConfigRepository) {}

  async execute(input: UpdateNotificationEventConfigInput): Promise<NotificationEventConfig> {
    return this.repo.update(input.id, input.is_enabled, input.updated_by);
  }
}
