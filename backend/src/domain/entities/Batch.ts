export interface Batch {
  id: string;
  batch_code: string;
  vaccine_id: string;
  expiry_date: string;
  closed_bottle_expiry_date: string;
  open_bottle_expiry_minutes: number;
  doses_per_bottle: number;
  ml_per_dose: number;
  is_deleted: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date | null;
}
