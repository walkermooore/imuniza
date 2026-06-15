import { User } from '@domain/entities/User';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { NotFoundError } from '@domain/errors';

export class GetUserByIdUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(id: string): Promise<Omit<User, 'password_hash'>> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }
}
