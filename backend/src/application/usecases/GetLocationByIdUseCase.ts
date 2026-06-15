import { Location } from '@domain/entities/Location';
import { ILocationRepository } from '@domain/repositories/ILocationRepository';
import { NotFoundError } from '@domain/errors';

export class GetLocationByIdUseCase {
  constructor(private readonly locationRepo: ILocationRepository) {}

  async execute(id: string): Promise<Location> {
    const location = await this.locationRepo.findById(id);
    if (!location) throw new NotFoundError('Location not found');
    return location;
  }
}
