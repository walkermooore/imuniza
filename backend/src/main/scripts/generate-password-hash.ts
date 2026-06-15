import { BcryptPasswordService } from '@infrastructure/services/BcryptPasswordService';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run auth:password <password>');
  process.exit(1);
}

const passwordService = new BcryptPasswordService();

passwordService.hash(password).then((hash) => {
  console.log(hash);
  process.exit(0);
});
