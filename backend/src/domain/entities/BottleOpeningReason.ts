export interface BottleOpeningReason {
  id: string;
  name: string;
  is_default: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date | null;
}
