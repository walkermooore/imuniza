import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { LoginUseCase } from '@application/usecases/LoginUseCase';
import { UnauthorizedError } from '@domain/errors';
import { ok, fail } from '@interface/helpers/response';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function createAuthRouter(loginUseCase: LoginUseCase): Router {
  const router = Router();

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Authenticate user and get access token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accessToken:
   *                   type: string
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     name:
   *                       type: string
   *                     email:
   *                       type: string
   *                     role:
   *                       type: string
   *       401:
   *         description: Invalid credentials
   *       422:
   *         description: Validation error
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const result = await loginUseCase.execute(parsed.data);
      ok(res, result);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        fail(res, 'Invalid credentials', 401);
        return;
      }
      throw err;
    }
  });

  return router;
}
