export interface BottleOpening {
  id: string;
  batch_entry_id: string;
  vaccine_room_id: string;
  opened_at: Date;
  comment: string | null;
  opening_reason_id: string | null;
  alert_triggered: boolean;
  is_cancelled: boolean;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  bulk_opening_id: string | null;
  created_by: string;
  created_at: Date;
}
