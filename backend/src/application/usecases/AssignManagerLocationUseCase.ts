import { ManagerLocation } from '@domain/entities/ManagerLocation';
import { IManagerLocationRepository } from '@domain/repositories/IManagerLocationRepository';
import { ConflictError } from '@domain/errors';

export type AssignManagerLocationDTO = {
  user_id: string;
  location_id: string;
  createdBy: string;
};

export class AssignManagerLocationUseCase {
  constructor(private readonly managerLocationRepo: IManagerLocationRepository) {}

  async execute(dto: AssignManagerLocationDTO): Promise<ManagerLocation> {
    const existing = await this.managerLocationRepo.findActive(dto.user_id, dto.location_id);
    if (existing) throw new ConflictError('Manager is already assigned to this location');

    return this.managerLocationRepo.create({
      user_id: dto.user_id,
      location_id: dto.location_id,
      created_by: dto.createdBy,
    });
  }
}
