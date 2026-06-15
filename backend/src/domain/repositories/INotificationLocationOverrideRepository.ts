import { NotificationLocationOverride } from '@domain/entities/NotificationLocationOverride';

export type CreateNotificationLocationOverrideInput = {
  event_config_id: string;
  location_id: string;
  is_enabled: boolean;
  created_by: string;
};

export interface INotificationLocationOverrideRepository {
  findAll(search?: string): Promise<NotificationLocationOverride[]>;
  findById(id: string): Promise<NotificationLocationOverride | null>;
  findByLocationAndEventConfig(locationId: string, eventConfigId: string): Promise<NotificationLocationOverride | null>;
  create(input: CreateNotificationLocationOverrideInput): Promise<NotificationLocationOverride>;
  update(id: string, isEnabled: boolean): Promise<NotificationLocationOverride>;
  delete(id: string): Promise<void>;
}
