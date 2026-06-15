import { Batch } from '@domain/entities/Batch';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBatchInput = {
  batch_code: string;
  vaccine_id: string;
  expiry_date: string;
  closed_bottle_expiry_date: string;
  open_bottle_expiry_minutes: number;
  doses_per_bottle: number;
  ml_per_dose: number;
  created_by: string;
};

export type UpdateBatchInput = Partial<{
  batch_code: string;
  vaccine_id: string;
  expiry_date: string;
  closed_bottle_expiry_date: string;
  open_bottle_expiry_minutes: number;
  doses_per_bottle: number;
  ml_per_dose: number;
}>;

export interface IBatchRepository {
  create(input: CreateBatchInput): Promise<Batch>;
  findById(id: string): Promise<Batch | null>;
  findByCodeAndVaccine(batch_code: string, vaccine_id: string): Promise<Batch | null>;
  list(params: PaginationParams): Promise<PaginatedResult<Batch>>;
  update(id: string, input: UpdateBatchInput): Promise<Batch | null>;
  softDelete(id: string): Promise<void>;
}
