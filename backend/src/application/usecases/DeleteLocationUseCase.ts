import { ILocationRepository } from '@domain/repositories/ILocationRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteLocationUseCase {
  constructor(private readonly locationRepo: ILocationRepository) {}

  async execute(id: string, deletedBy: string): Promise<void> {
    const existing = await this.locationRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Location not found');

    await this.locationRepo.softDelete(id, deletedBy);
  }
}
