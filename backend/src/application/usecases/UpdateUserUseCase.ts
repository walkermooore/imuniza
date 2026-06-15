import { User } from '@domain/entities/User';
import { IUserRepository, UpdateUserInput } from '@domain/repositories/IUserRepository';
import { NotFoundError } from '@domain/errors';

export class UpdateUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(id: string, input: UpdateUserInput, updatedBy: string): Promise<Omit<User, 'password_hash'>> {
    const existing = await this.userRepo.findById(id);
    if (!existing) throw new NotFoundError('User not found');

    const updated = await this.userRepo.update(id, { ...input, updated_by: updatedBy });
    if (!updated) throw new NotFoundError('User not found');
    return updated;
  }
}
