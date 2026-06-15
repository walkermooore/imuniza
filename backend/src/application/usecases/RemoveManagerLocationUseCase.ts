import { IManagerLocationRepository } from '@domain/repositories/IManagerLocationRepository';
import { NotFoundError } from '@domain/errors';

export class RemoveManagerLocationUseCase {
  constructor(private readonly managerLocationRepo: IManagerLocationRepository) {}

  async execute(id: string): Promise<void> {
    const record = await this.managerLocationRepo.findById(id);
    if (!record) throw new NotFoundError('Manager location not found');

    await this.managerLocationRepo.softDelete(id);
  }
}
