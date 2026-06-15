import { Location, LocationType } from '@domain/entities/Location';
import { ILocationRepository } from '@domain/repositories/ILocationRepository';
import { ConflictError } from '@domain/errors';

export type CreateLocationDTO = {
  name: string;
  address: string;
  type: LocationType;
  other_description?: string;
  createdBy?: string;
};

export class CreateLocationUseCase {
  constructor(private readonly locationRepo: ILocationRepository) {}

  async execute(dto: CreateLocationDTO): Promise<Location> {
    if (dto.type === LocationType.outro && !dto.other_description?.trim()) {
      throw new ConflictError('other_description is required when type is "outro"');
    }

    return this.locationRepo.create({
      name: dto.name,
      address: dto.address,
      type: dto.type,
      other_description: dto.type === LocationType.outro ? dto.other_description : undefined,
      created_by: dto.createdBy,
    });
  }
}
