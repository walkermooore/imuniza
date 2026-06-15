import { SystemParameter } from '@domain/entities/SystemParameter';
import { ISystemParameterRepository } from '@domain/repositories/ISystemParameterRepository';

export interface UpdateSystemParameterInput {
  id: string;
  value: string;
  updatedBy: string;
}

export class UpdateSystemParameterUseCase {
  constructor(private readonly repo: ISystemParameterRepository) {}

  async execute(input: UpdateSystemParameterInput): Promise<SystemParameter> {
    return this.repo.update(input.id, input.value, input.updatedBy);
  }
}
