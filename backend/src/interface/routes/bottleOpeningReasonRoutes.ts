import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBottleOpeningReasonUseCase } from '@application/usecases/CreateBottleOpeningReasonUseCase';
import { ListBottleOpeningReasonsUseCase } from '@application/usecases/ListBottleOpeningReasonsUseCase';
import { GetBottleOpeningReasonByIdUseCase } from '@application/usecases/GetBottleOpeningReasonByIdUseCase';
import { UpdateBottleOpeningReasonUseCase } from '@application/usecases/UpdateBottleOpeningReasonUseCase';
import { DeleteBottleOpeningReasonUseCase } from '@application/usecases/DeleteBottleOpeningReasonUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema;

const createBottleOpeningReasonSchema = z.object({
  name: z.string().min(1),
  is_default: z.boolean().optional(),
});

const updateBottleOpeningReasonSchema = z.object({
  name: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

export function createBottleOpeningReasonsRouter(
  tokenService: ITokenService,
  createBottleOpeningReasonUseCase: CreateBottleOpeningReasonUseCase,
  listBottleOpeningReasonsUseCase: ListBottleOpeningReasonsUseCase,
  getBottleOpeningReasonByIdUseCase: GetBottleOpeningReasonByIdUseCase,
  updateBottleOpeningReasonUseCase: UpdateBottleOpeningReasonUseCase,
  deleteBottleOpeningReasonUseCase: DeleteBottleOpeningReasonUseCase,
): Router {
  const router = Router();
  const auth = createAuthMiddleware(tokenService);
  const allRoles = roleGuard([
    UserRole.administrador,
    UserRole.gestor,
    UserRole.tecnico,
  ]);
  const managerRoles = roleGuard([UserRole.administrador]);

  /**
   * @swagger
   * /bottle-opening-reasons:
   *   get:
   *     summary: List all active bottle opening reasons (paginated)
   *     tags: [BottleOpeningReasons]
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
   *         description: Paginated list of bottle opening reasons
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Invalid pagination params
   */
  router.get('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid pagination params', 422, parsed.error.format());
      return;
    }
    const result = await listBottleOpeningReasonsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /bottle-opening-reasons/{id}:
   *   get:
   *     summary: Get bottle opening reason by ID
   *     tags: [BottleOpeningReasons]
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
   *         description: Bottle opening reason found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const reason = await getBottleOpeningReasonByIdUseCase.execute(req.params.id);
      ok(res, reason);
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
   * /bottle-opening-reasons:
   *   post:
   *     summary: Create a new bottle opening reason
   *     tags: [BottleOpeningReasons]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *               is_default:
   *                 type: boolean
   *                 description: Only one reason can be default at a time
   *     responses:
   *       201:
   *         description: Bottle opening reason created
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       409:
   *         description: Business rule violation (another default already exists)
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = createBottleOpeningReasonSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const reason = await createBottleOpeningReasonUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
      ok(res, reason, 201);
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
   * /bottle-opening-reasons/{id}:
   *   put:
   *     summary: Update a bottle opening reason
   *     tags: [BottleOpeningReasons]
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
   *               is_default:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Bottle opening reason updated
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   *       409:
   *         description: Business rule violation (another default already exists)
   *       422:
   *         description: Validation error
   */
  router.put('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = updateBottleOpeningReasonSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const reason = await updateBottleOpeningReasonUseCase.execute(req.params.id, parsed.data, req.user!.id);
      ok(res, reason);
    } catch (err) {
      if (err instanceof NotFoundError) {
        fail(res, err.message, 404);
        return;
      }
      if (err instanceof ConflictError) {
        fail(res, err.message, 409);
        return;
      }
      throw err;
    }
  });

  /**
   * @swagger
   * /bottle-opening-reasons/{id}:
   *   delete:
   *     summary: Soft delete a bottle opening reason
   *     tags: [BottleOpeningReasons]
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
   *         description: Deleted
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.delete('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      await deleteBottleOpeningReasonUseCase.execute(req.params.id);
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
