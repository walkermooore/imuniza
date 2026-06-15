export interface NotificationEventConfig {
  id: string;
  event_type: 'bottle_opening' | 'bottle_discard';
  label: string;
  is_enabled: boolean;
  created_by: string | null;
  created_at: Date;
  updated_by: string | null;
  updated_at: Date | null;
}
