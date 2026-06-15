import { TechnicianRoom } from '@domain/entities/TechnicianRoom';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export type CreateTechnicianRoomInput = {
  user_id: string;
  vaccine_room_id: string;
  created_by: string;
};

export type ListTechnicianRoomsInput = PaginationParams & {
  user_id?: string;
  vaccine_room_id?: string;
};

export interface ITechnicianRoomRepository {
  create(input: CreateTechnicianRoomInput): Promise<TechnicianRoom>;
  findById(id: string): Promise<TechnicianRoom | null>;
  findActive(user_id: string, vaccine_room_id: string): Promise<TechnicianRoom | null>;
  list(params: ListTechnicianRoomsInput): Promise<PaginatedResult<TechnicianRoom>>;
  softDelete(id: string): Promise<void>;
}
