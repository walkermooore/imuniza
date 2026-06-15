import { IUserRepository } from '@domain/repositories/IUserRepository';
import { NotFoundError } from '@domain/errors';

export class DeleteUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.userRepo.findById(id);
    if (!existing) throw new NotFoundError('User not found');
    await this.userRepo.softDelete(id);
  }
}
