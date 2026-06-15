import { Batch } from '@domain/entities/Batch';
import { IBatchRepository, UpdateBatchInput } from '@domain/repositories/IBatchRepository';
import { IVaccineRepository } from '@domain/repositories/IVaccineRepository';
import { NotFoundError, ConflictError } from '@domain/errors';

export class UpdateBatchUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly vaccineRepo: IVaccineRepository,
  ) {}

  async execute(id: string, input: UpdateBatchInput): Promise<Batch> {
    const existing = await this.batchRepo.findById(id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Batch not found');

    if (input.vaccine_id && input.vaccine_id !== existing.vaccine_id) {
      const vaccine = await this.vaccineRepo.findById(input.vaccine_id);
      if (!vaccine) throw new ConflictError('Vaccine not found');
    }

    const resolvedCode = input.batch_code ?? existing.batch_code;
    const resolvedVaccineId = input.vaccine_id ?? existing.vaccine_id;

    if (input.batch_code !== undefined || input.vaccine_id !== undefined) {
      const duplicate = await this.batchRepo.findByCodeAndVaccine(resolvedCode, resolvedVaccineId);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Batch code already exists for this vaccine');
      }
    }

    const updated = await this.batchRepo.update(id, input);
    if (!updated) throw new NotFoundError('Batch not found');
    return updated;
  }
}
