import { BottleDiscard } from '@domain/entities/BottleDiscard';
import { IBottleDiscardRepository } from '@domain/repositories/IBottleDiscardRepository';
import { NotFoundError } from '@domain/errors';

export class GetBottleDiscardByIdUseCase {
  constructor(private readonly repo: IBottleDiscardRepository) {}

  async execute(id: string): Promise<BottleDiscard> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundError('Bottle discard not found');
    return record;
  }
}
