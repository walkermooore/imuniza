export interface BatchRoomEntry {
  id: string;
  batch_id: string;
  vaccine_room_id: string;
  bottle_count: number;
  source_batch_entry_id: string | null;
  is_deleted: boolean;
  created_by: string;
  created_at: Date;
}
