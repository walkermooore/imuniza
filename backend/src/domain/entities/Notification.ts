export interface Notification {
  id: string;
  user_id: string;
  event_type: 'bottle_opening' | 'bottle_discard';
  entity_id: string;
  entity_table: string;
  source_vaccine_room_id: string;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
  description?: string;
}
