import { Batch } from '@domain/entities/Batch';
import { IBatchRepository } from '@domain/repositories/IBatchRepository';
import { IVaccineRepository } from '@domain/repositories/IVaccineRepository';
import { ConflictError } from '@domain/errors';

export type CreateBatchDTO = {
  batch_code: string;
  vaccine_id: string;
  expiry_date: string;
  closed_bottle_expiry_date: string;
  open_bottle_expiry_minutes: number;
  doses_per_bottle: number;
  ml_per_dose: number;
  created_by: string;
};

export class CreateBatchUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly vaccineRepo: IVaccineRepository,
  ) {}

  async execute(dto: CreateBatchDTO): Promise<Batch> {
    const vaccine = await this.vaccineRepo.findById(dto.vaccine_id);
    if (!vaccine) throw new ConflictError('Vaccine not found');

    const existing = await this.batchRepo.findByCodeAndVaccine(dto.batch_code, dto.vaccine_id);
    if (existing) throw new ConflictError('Batch code already exists for this vaccine');

    return this.batchRepo.create({
      batch_code: dto.batch_code,
      vaccine_id: dto.vaccine_id,
      expiry_date: dto.expiry_date,
      closed_bottle_expiry_date: dto.closed_bottle_expiry_date,
      open_bottle_expiry_minutes: dto.open_bottle_expiry_minutes,
      doses_per_bottle: dto.doses_per_bottle,
      ml_per_dose: dto.ml_per_dose,
      created_by: dto.created_by,
    });
  }
}
