export interface Vaccine {
  id: string;
  name: string;
  laboratory_id: string;
  laboratory_name?: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date | null;
}
