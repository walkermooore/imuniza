import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IPasswordService } from '@domain/services/IPasswordService';
import { ITokenService } from '@domain/services/ITokenService';
import { UnauthorizedError } from '@domain/errors';

export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
  ) {}

  async execute(dto: LoginDTO): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(dto.email);

    if (!user || !user.is_active) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const passwordMatch = await this.passwordService.compare(dto.password, user.password_hash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = this.tokenService.generate({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
