export type BulkDiscardMode = 'A' | 'B';

export interface BulkBottleDiscard {
  id: string;
  batch_entry_id: string;
  vaccine_room_id: string;
  mode: BulkDiscardMode;
  discarded_at: Date;
  discard_reason_id: string;
  quantity: number;
  quantity_executed: number;
  quantity_cancelled: number;
  comment: string | null;
  created_by: string;
  created_at: Date;
}
