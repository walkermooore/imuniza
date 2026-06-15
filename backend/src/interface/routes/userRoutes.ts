import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateUserUseCase } from '@application/usecases/CreateUserUseCase';
import { ListUsersUseCase } from '@application/usecases/ListUsersUseCase';
import { GetUserByIdUseCase } from '@application/usecases/GetUserByIdUseCase';
import { UpdateUserUseCase } from '@application/usecases/UpdateUserUseCase';
import { DeleteUserUseCase } from '@application/usecases/DeleteUserUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema;

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
  job_title: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  job_title: z.string().nullable().optional(),
  role: z.nativeEnum(UserRole).optional(),
  is_active: z.boolean().optional(),
});

export function createUsersRouter(
  tokenService: ITokenService,
  createUserUseCase: CreateUserUseCase,
  listUsersUseCase: ListUsersUseCase,
  getUserByIdUseCase: GetUserByIdUseCase,
  updateUserUseCase: UpdateUserUseCase,
  deleteUserUseCase: DeleteUserUseCase,
): Router {
  const router = Router();
  const auth = createAuthMiddleware(tokenService);
  const adminOnly = roleGuard([UserRole.administrador]);
  const managerRoles = roleGuard([UserRole.administrador]);

  /**
   * @swagger
   * /users:
   *   get:
   *     summary: List all active users (paginated)
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number (starts at 1)
   *       - in: query
   *         name: page_size
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: Number of items per page
   *     responses:
   *       200:
   *         description: Paginated list of users
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Invalid pagination params
   */
  router.get('/', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid pagination params', 422, parsed.error.format());
      return;
    }
    const result = await listUsersUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /users/{id}:
   *   get:
   *     summary: Get user by ID
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: User found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await getUserByIdUseCase.execute(req.params.id);
      ok(res, user);
    } catch (err) {
      if (err instanceof NotFoundError) {
        fail(res, err.message, 404);
        return;
      }
      throw err;
    }
  });

  /**
   * @swagger
   * /users:
   *   post:
   *     summary: Create a new user
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email, password, role]
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               role:
   *                 type: string
   *               job_title:
   *                 type: string
   *     responses:
   *       201:
   *         description: User created
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       409:
   *         description: Email already in use
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, adminOnly, async (req: Request, res: Response): Promise<void> => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const user = await createUserUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
      ok(res, user, 201);
    } catch (err) {
      if (err instanceof ConflictError) {
        fail(res, err.message, 409);
        return;
      }
      throw err;
    }
  });

  /**
   * @swagger
   * /users/{id}:
   *   put:
   *     summary: Update a user
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               job_title:
   *                 type: string
   *               role:
   *                 type: string
   *               is_active:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: User updated
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   *       422:
   *         description: Validation error
   */
  router.put('/:id', auth, adminOnly, async (req: Request, res: Response): Promise<void> => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const user = await updateUserUseCase.execute(req.params.id, parsed.data, req.user!.id);
      ok(res, user);
    } catch (err) {
      if (err instanceof NotFoundError) {
        fail(res, err.message, 404);
        return;
      }
      throw err;
    }
  });

  /**
   * @swagger
   * /users/{id}:
   *   delete:
   *     summary: Soft delete a user
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Deleted
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.delete('/:id', auth, adminOnly, async (req: Request, res: Response): Promise<void> => {
    try {
      await deleteUserUseCase.execute(req.params.id);
      ok(res, null);
    } catch (err) {
      if (err instanceof NotFoundError) {
        fail(res, err.message, 404);
        return;
      }
      throw err;
    }
  });

  return router;
}
