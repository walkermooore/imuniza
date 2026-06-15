export interface BottleDiscard {
  id: string;
  batch_entry_id: string;
  bottle_opening_id: string | null;
  discarded_at: Date;
  discard_reason_id: string;
  remaining_doses: number | null;
  comment: string | null;
  is_cancelled: boolean;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  bulk_discard_id: string | null;
  created_by: string;
  created_at: Date;
}
