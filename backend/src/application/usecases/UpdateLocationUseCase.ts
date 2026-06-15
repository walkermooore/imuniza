import { Location, LocationType } from '@domain/entities/Location';
import { ILocationRepository, UpdateLocationInput } from '@domain/repositories/ILocationRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export class UpdateLocationUseCase {
  constructor(private readonly locationRepo: ILocationRepository) {}

  async execute(id: string, input: UpdateLocationInput, updatedBy: string): Promise<Location> {
    const existing = await this.locationRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Location not found');

    const resolvedType = input.type ?? existing.type;

    if (resolvedType === LocationType.outro) {
      const resolvedDescription =
        'other_description' in input ? input.other_description : existing.other_description;
      if (!resolvedDescription?.trim()) {
        throw new ConflictError('other_description is required when type is "outro"');
      }
    }

    if (resolvedType !== LocationType.outro && 'other_description' in input) {
      input = { ...input, other_description: null };
    }

    const updated = await this.locationRepo.update(id, { ...input, updated_by: updatedBy });
    if (!updated) throw new NotFoundError('Location not found');
    return updated;
  }
}
