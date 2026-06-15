export enum LocationType {
  ubs = 'ubs',
  lugar_temporario = 'lugar_temporario',
  escola = 'escola',
  hospital = 'hospital',
  outro = 'outro',
}

export interface Location {
  id: string;
  name: string;
  address: string;
  type: LocationType;
  other_description: string | null;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
}
