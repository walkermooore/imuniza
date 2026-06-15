export enum UserRole {
  administrador = 'administrador',
  gestor = 'gestor',
  tecnico = 'tecnico',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  job_title: string | null;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
