export type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface BatchTransfer {
  id: string;
  source_batch_entry_id: string;
  destined_batch_entry_id: string | null;
  origin_vaccine_room_id: string;
  destination_vaccine_room_id: string;
  bottle_count: number;
  status: TransferStatus;
  expires_at: Date;
  requested_by: string;
  requested_at: Date;
  resolved_by: string | null;
  resolved_at: Date | null;
  comment: string | null;
  created_at: Date;
}
