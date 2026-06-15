import { VaccineRoom } from '@domain/entities/VaccineRoom';
import { IVaccineRoomRepository } from '@domain/repositories/IVaccineRoomRepository';

export type CreateVaccineRoomDTO = {
  location_id: string;
  description: string;
  createdBy?: string;
};

export class CreateVaccineRoomUseCase {
  constructor(private readonly vaccineRoomRepo: IVaccineRoomRepository) {}

  async execute(dto: CreateVaccineRoomDTO): Promise<VaccineRoom> {
    return this.vaccineRoomRepo.create({
      location_id: dto.location_id,
      description: dto.description,
      created_by: dto.createdBy,
    });
  }
}
