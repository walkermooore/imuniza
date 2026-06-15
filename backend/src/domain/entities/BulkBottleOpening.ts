export interface BulkBottleOpening {
  id: string;
  batch_entry_id: string;
  vaccine_room_id: string;
  opened_at: Date;
  quantity: number;
  quantity_executed: number;
  quantity_cancelled: number;
  comment: string | null;
  opening_reason_id: string | null;
  alert_triggered: boolean;
  created_by: string;
  created_at: Date;
}
