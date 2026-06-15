import { Vaccine } from '@domain/entities/Vaccine';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateVaccineInput = {
  name: string;
  laboratory_id: string;
  created_by?: string;
};

export type UpdateVaccineInput = Partial<{
  name: string;
  laboratory_id: string;
  updated_by: string;
}>;

export interface IVaccineRepository {
  create(input: CreateVaccineInput): Promise<Vaccine>;
  findById(id: string): Promise<Vaccine | null>;
  list(params: PaginationParams): Promise<PaginatedResult<Vaccine>>;
  update(id: string, input: UpdateVaccineInput): Promise<Vaccine | null>;
  softDelete(id: string): Promise<void>;
}
