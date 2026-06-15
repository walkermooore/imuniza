import { BottleOpeningReason } from '@domain/entities/BottleOpeningReason';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateBottleOpeningReasonInput = {
  name: string;
  is_default?: boolean;
  created_by?: string;
};

export type UpdateBottleOpeningReasonInput = Partial<{
  name: string;
  is_default: boolean;
  updated_by: string;
}>;

export interface IBottleOpeningReasonRepository {
  create(input: CreateBottleOpeningReasonInput): Promise<BottleOpeningReason>;
  findById(id: string): Promise<BottleOpeningReason | null>;
  findDefault(): Promise<BottleOpeningReason | null>;
  list(params: PaginationParams): Promise<PaginatedResult<BottleOpeningReason>>;
  update(id: string, input: UpdateBottleOpeningReasonInput): Promise<BottleOpeningReason | null>;
  softDelete(id: string): Promise<void>;
}
