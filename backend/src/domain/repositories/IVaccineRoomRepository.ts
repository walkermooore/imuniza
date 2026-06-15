import { VaccineRoom } from '@domain/entities/VaccineRoom';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateVaccineRoomInput = {
  location_id: string;
  description: string;
  created_by?: string;
};

export type UpdateVaccineRoomInput = Partial<{
  description: string;
  updated_by: string;
}>;

export interface IVaccineRoomRepository {
  create(input: CreateVaccineRoomInput): Promise<VaccineRoom>;
  findById(id: string): Promise<VaccineRoom | null>;
  list(params: PaginationParams & { location_id?: string }): Promise<PaginatedResult<VaccineRoom>>;
  update(id: string, input: UpdateVaccineRoomInput): Promise<VaccineRoom | null>;
  softDelete(id: string, deletedBy: string): Promise<void>;
}
