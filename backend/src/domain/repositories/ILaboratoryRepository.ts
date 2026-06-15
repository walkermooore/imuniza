import { Laboratory } from '@domain/entities/Laboratory';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateLaboratoryInput = {
  name: string;
  created_by?: string;
};

export type UpdateLaboratoryInput = Partial<{
  name: string;
  updated_by: string;
}>;

export interface ILaboratoryRepository {
  create(input: CreateLaboratoryInput): Promise<Laboratory>;
  findById(id: string): Promise<Laboratory | null>;
  list(params: PaginationParams): Promise<PaginatedResult<Laboratory>>;
  update(id: string, input: UpdateLaboratoryInput): Promise<Laboratory | null>;
  softDelete(id: string): Promise<void>;
}
