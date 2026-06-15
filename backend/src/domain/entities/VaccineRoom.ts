export interface VaccineRoom {
  id: string;
  location_id: string;
  location_name: string;
  description: string;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
}
