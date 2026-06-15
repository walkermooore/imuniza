import { SystemParameter } from '@domain/entities/SystemParameter';

export interface ISystemParameterRepository {
  findAll(search?: string): Promise<SystemParameter[]>;
  findById(id: string): Promise<SystemParameter | null>;
  findByKey(key: string): Promise<SystemParameter | null>;
  update(id: string, value: string, updatedBy: string): Promise<SystemParameter>;
}
