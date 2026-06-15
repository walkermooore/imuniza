import { SystemParameter } from '@domain/entities/SystemParameter';
import { ISystemParameterRepository } from '@domain/repositories/ISystemParameterRepository';

export class ListSystemParametersUseCase {
  constructor(private readonly repo: ISystemParameterRepository) {}

  async execute(search?: string): Promise<SystemParameter[]> {
    return this.repo.findAll(search);
  }
}
