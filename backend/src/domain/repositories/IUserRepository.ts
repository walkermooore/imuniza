import { User } from '@domain/entities/User';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateUserInput = {
  name: string;
  email: string;
  role: User['role'];
  job_title?: string;
  password_hash: string;
  created_by?: string;
};

export type UpdateUserInput = Partial<{
  name: string;
  email: string;
  role: User['role'];
  job_title: string | null;
  is_active: boolean;
  updated_by: string;
}>;

export interface IUserRepository {
  create(input: CreateUserInput): Promise<Omit<User, 'password_hash'>>;
  findById(id: string): Promise<Omit<User, 'password_hash'> | null>;
  findByEmail(email: string): Promise<User | null>;
  list(params: PaginationParams): Promise<PaginatedResult<Omit<User, 'password_hash'>>>;
  update(id: string, input: UpdateUserInput): Promise<Omit<User, 'password_hash'> | null>;
  softDelete(id: string): Promise<void>;
}
