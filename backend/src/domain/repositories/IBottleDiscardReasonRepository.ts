import { BottleDiscardReason } from '@domain/entities/BottleDiscardReason';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBottleDiscardReasonInput = {
  name: string;
  is_default?: boolean;
  created_by?: string;
};

export type UpdateBottleDiscardReasonInput = Partial<{
  name: string;
  is_default: boolean;
  updated_by: string;
}>;

export interface IBottleDiscardReasonRepository {
  create(input: CreateBottleDiscardReasonInput): Promise<BottleDiscardReason>;
  findById(id: string): Promise<BottleDiscardReason | null>;
  findDefault(): Promise<BottleDiscardReason | null>;
  list(params: PaginationParams): Promise<PaginatedResult<BottleDiscardReason>>;
  update(id: string, input: UpdateBottleDiscardReasonInput): Promise<BottleDiscardReason | null>;
  softDelete(id: string): Promise<void>;
}
