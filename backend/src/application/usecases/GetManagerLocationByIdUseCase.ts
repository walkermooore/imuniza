import { ManagerLocation } from '@domain/entities/ManagerLocation';
import { IManagerLocationRepository } from '@domain/repositories/IManagerLocationRepository';
import { NotFoundError } from '@domain/errors';

export class GetManagerLocationByIdUseCase {
  constructor(private readonly managerLocationRepo: IManagerLocationRepository) {}

  async execute(id: string): Promise<ManagerLocation> {
    const record = await this.managerLocationRepo.findById(id);
    if (!record) throw new NotFoundError('Manager location not found');
    return record;
  }
}
