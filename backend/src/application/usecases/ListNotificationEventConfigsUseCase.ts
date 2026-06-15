import { NotificationEventConfig } from '@domain/entities/NotificationEventConfig';
import { INotificationEventConfigRepository } from '@domain/repositories/INotificationEventConfigRepository';

export class ListNotificationEventConfigsUseCase {
  constructor(private readonly repo: INotificationEventConfigRepository) {}

  async execute(search?: string): Promise<NotificationEventConfig[]> {
    return this.repo.findAll(search);
  }
}
