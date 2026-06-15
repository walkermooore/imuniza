import { User } from '@domain/entities/User';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { PaginationParams, PaginatedResult } from '@domain/shared/Pagination';

export class ListUsersUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(params: PaginationParams): Promise<PaginatedResult<Omit<User, 'password_hash'>>> {
    return this.userRepo.list(params);
  }
}
