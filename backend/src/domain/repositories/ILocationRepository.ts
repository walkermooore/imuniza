import { Location, LocationType } from '@domain/entities/Location';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateLocationInput = {
  name: string;
  address: string;
  type: LocationType;
  other_description?: string;
  created_by?: string;
};

export type UpdateLocationInput = Partial<{
  name: string;
  address: string;
  type: LocationType;
  other_description: string | null;
  updated_by: string;
}>;

export interface ILocationRepository {
  create(input: CreateLocationInput): Promise<Location>;
  findById(id: string): Promise<Location | null>;
  list(params: PaginationParams): Promise<PaginatedResult<Location>>;
  update(id: string, input: UpdateLocationInput): Promise<Location | null>;
  softDelete(id: string, deletedBy: string): Promise<void>;
}
