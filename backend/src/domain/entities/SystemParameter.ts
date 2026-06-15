export interface SystemParameter {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedBy: string | null;
  updatedAt: Date | null;
}
