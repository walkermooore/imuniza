import bcrypt from 'bcrypt';
import { IPasswordService } from '@domain/services/IPasswordService';

const SALT_ROUNDS = 12;

export class BcryptPasswordService implements IPasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
