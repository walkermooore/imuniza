import { BottleOpeningReason } from '@domain/entities/BottleOpeningReason';
import { IBottleOpeningReasonRepository } from '@domain/repositories/IBottleOpeningReasonRepository';
import { ConflictError } from '@domain/errors';

export type CreateBottleOpeningReasonDTO = {
  name: string;
  is_default?: boolean;
  createdBy?: string;
};

export class CreateBottleOpeningReasonUseCase {
  constructor(private readonly bottleOpeningReasonRepo: IBottleOpeningReasonRepository) {}

  async execute(dto: CreateBottleOpeningReasonDTO): Promise<BottleOpeningReason> {
    if (dto.is_default) {
      const existingDefault = await this.bottleOpeningReasonRepo.findDefault();
      if (existingDefault) {
        throw new ConflictError('Another default reason already exists');
      }
    }

    return this.bottleOpeningReasonRepo.create({
      name: dto.name,
      is_default: dto.is_default ?? false,
      created_by: dto.createdBy,
    });
  }
}
