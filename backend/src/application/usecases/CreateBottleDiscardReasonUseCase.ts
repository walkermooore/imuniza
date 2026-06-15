import { BottleDiscardReason } from '@domain/entities/BottleDiscardReason';
import { IBottleDiscardReasonRepository } from '@domain/repositories/IBottleDiscardReasonRepository';
import { ConflictError } from '@domain/errors';

export type CreateBottleDiscardReasonDTO = {
  name: string;
  is_default?: boolean;
  createdBy?: string;
};

export class CreateBottleDiscardReasonUseCase {
  constructor(private readonly bottleDiscardReasonRepo: IBottleDiscardReasonRepository) {}

  async execute(dto: CreateBottleDiscardReasonDTO): Promise<BottleDiscardReason> {
    if (dto.is_default) {
      const existingDefault = await this.bottleDiscardReasonRepo.findDefault();
      if (existingDefault) {
        throw new ConflictError('Another default reason already exists');
      }
    }

    return this.bottleDiscardReasonRepo.create({
      name: dto.name,
      is_default: dto.is_default ?? false,
      created_by: dto.createdBy,
    });
  }
}
