import { SystemParameter } from '@domain/entities/SystemParameter';
import { ISystemParameterRepository } from '@domain/repositories/ISystemParameterRepository';
import { NotFoundError } from '@domain/errors';

export class GetSystemParameterUseCase {
  constructor(private readonly repo: ISystemParameterRepository) {}

  async execute(id: string): Promise<SystemParameter> {
    const param = await this.repo.findById(id);
    if (!param) throw new NotFoundError('SystemParameter not found');
    return param;
  }
}
