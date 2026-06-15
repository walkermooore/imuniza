import { ManagerLocation } from '@domain/entities/ManagerLocation';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateManagerLocationInput = {
  user_id: string;
  location_id: string;
  created_by: string;
};

export type ListManagerLocationsInput = PaginationParams & {
  user_id?: string;
  location_id?: string;
};

export interface IManagerLocationRepository {
  create(input: CreateManagerLocationInput): Promise<ManagerLocation>;
  findById(id: string): Promise<ManagerLocation | null>;
  findActive(user_id: string, location_id: string): Promise<ManagerLocation | null>;
  list(params: ListManagerLocationsInput): Promise<PaginatedResult<ManagerLocation>>;
  softDelete(id: string): Promise<void>;
}
