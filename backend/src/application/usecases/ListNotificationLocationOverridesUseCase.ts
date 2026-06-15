import { NotificationLocationOverride } from '@domain/entities/NotificationLocationOverride';
import { INotificationLocationOverrideRepository } from '@domain/repositories/INotificationLocationOverrideRepository';

export class ListNotificationLocationOverridesUseCase {
  constructor(private readonly repo: INotificationLocationOverrideRepository) {}

  async execute(search?: string): Promise<NotificationLocationOverride[]> {
    return this.repo.findAll(search);
  }
}
