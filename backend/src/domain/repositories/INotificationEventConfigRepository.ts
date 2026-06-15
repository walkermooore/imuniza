import { NotificationEventConfig } from '@domain/entities/NotificationEventConfig';

export interface INotificationEventConfigRepository {
  findAll(search?: string): Promise<NotificationEventConfig[]>;
  findById(id: string): Promise<NotificationEventConfig | null>;
  update(id: string, isEnabled: boolean, updatedBy: string): Promise<NotificationEventConfig>;
}
