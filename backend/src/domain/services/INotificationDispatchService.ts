export interface NotificationDispatchInput {
  vaccine_room_id: string;
  event_type: 'bottle_opening' | 'bottle_discard';
  entity_id: string;
  entity_table: string;
  created_by: string;
}

export interface INotificationDispatchService {
  dispatch(input: NotificationDispatchInput): Promise<void>;
}
