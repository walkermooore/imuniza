import { BottleOpening } from '@domain/entities/BottleOpening';
import { IBottleOpeningRepository } from '@domain/repositories/IBottleOpeningRepository';
import { NotFoundError } from '@domain/errors';

export class GetBottleOpeningByIdUseCase {
  constructor(private readonly repo: IBottleOpeningRepository) {}

  async execute(id: string): Promise<BottleOpening> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError('Bottle opening not found');
    return record;
  }
}
