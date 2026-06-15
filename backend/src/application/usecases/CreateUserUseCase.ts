import { User } from '@domain/entities/User';
import { IUserRepository, CreateUserInput } from '@domain/repositories/IUserRepository';
import { IPasswordService } from '@domain/services/IPasswordService';
import { ConflictError } from '@domain/errors';

export type CreateUserDTO = Omit<CreateUserInput, 'password_hash'> & { password: string; createdBy?: string };

export class CreateUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordService: IPasswordService,
  ) {}

  async execute(dto: CreateUserDTO): Promise<Omit<User, 'password_hash'>> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictError('Email already in use');

    const password_hash = await this.passwordService.hash(dto.password);
    return this.userRepo.create({
      name: dto.name,
      email: dto.email,
      role: dto.role,
      job_title: dto.job_title,
      password_hash,
      created_by: dto.createdBy,
    });
  }
}
