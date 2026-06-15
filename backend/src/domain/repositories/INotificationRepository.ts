import { Notification } from '@domain/entities/Notification';
import { PaginatedResult, PaginationParams } from '@domain/shared/Pagination';

export type CreateNotificationInput = {
  user_id: string;
  event_type: 'bottle_opening' | 'bottle_discard';
  entity_id: string;
  entity_table: string;
  source_vaccine_room_id: string;
  created_by: string;
};

export interface INotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  findByUserId(userId: string, params: PaginationParams): Promise<PaginatedResult<Notification & { description: string }>>;
  markRead(id: string, userId: string): Promise<Notification | null>;
  markAllRead(userId: string): Promise<void>;
  findActiveSubscribers(vaccineRoomId: string, eventType: 'bottle_opening' | 'bottle_discard'): Promise<string[]>;
}
