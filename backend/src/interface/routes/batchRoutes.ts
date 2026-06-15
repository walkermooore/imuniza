import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBatchUseCase } from '@application/usecases/CreateBatchUseCase';
import { ListBatchesUseCase } from '@application/usecases/ListBatchesUseCase';
import { GetBatchByIdUseCase } from '@application/usecases/GetBatchByIdUseCase';
import { UpdateBatchUseCase } from '@application/usecases/UpdateBatchUseCase';
import { DeleteBatchUseCase } from '@application/usecases/DeleteBatchUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema;

const createBatchSchema = z.object({
  batch_code: z.string().min(1),
  vaccine_id: z.string().uuid(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closed_bottle_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open_bottle_expiry_minutes: z.number().int().positive(),
  doses_per_bottle: z.number().int().positive(),
  ml_per_dose: z.number().positive(),
});

const updateBatchSchema = createBatchSchema.partial();

export function createBatchesRouter(
  tokenService: ITokenService,
  createBatchUseCase: CreateBatchUseCase,
  listBatchesUseCase: ListBatchesUseCase,
  getBatchByIdUseCase: GetBatchByIdUseCase,
  updateBatchUseCase: UpdateBatchUseCase,
  deleteBatchUseCase: DeleteBatchUseCase,
): Router {
  const router = Router();
  const auth = createAuthMiddleware(tokenService);
  const allRoles = roleGuard([
    UserRole.administrador,
    UserRole.gestor,
    UserRole.tecnico,
  ]);
  const managerRoles = roleGuard([UserRole.administrador, UserRole.gestor]);

  /**
   * @swagger
   * /batches:
   *   get:
   *     summary: List all active batches (paginated)
   *     tags: [Batches]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: page_size
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *     responses:
   *       200:
   *         description: Paginated list of batches
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
    const result = await listBatchesUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /batches/{id}:
   *   get:
   *     summary: Get batch by ID
   *     tags: [Batches]
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
   *         description: Batch found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const batch = await getBatchByIdUseCase.execute(req.params.id);
      ok(res, batch);
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
   * /batches:
   *   post:
   *     summary: Create a new batch
   *     tags: [Batches]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [batch_code, vaccine_id, expiry_date, closed_bottle_expiry_date, open_bottle_expiry_minutes, doses_per_bottle, ml_per_dose]
   *             properties:
   *               batch_code:
   *                 type: string
   *               vaccine_id:
   *                 type: string
   *                 format: uuid
   *               expiry_date:
   *                 type: string
   *                 pattern: '^\d{4}-\d{2}-\d{2}$'
   *               closed_bottle_expiry_date:
   *                 type: string
   *                 pattern: '^\d{4}-\d{2}-\d{2}$'
   *               open_bottle_expiry_minutes:
   *                 type: integer
   *                 minimum: 1
   *               doses_per_bottle:
   *                 type: integer
   *                 minimum: 1
   *               ml_per_dose:
   *                 type: number
   *                 minimum: 0
   *     responses:
   *       201:
   *         description: Batch created
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       409:
   *         description: Business rule violation
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = createBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const batch = await createBatchUseCase.execute({
        ...parsed.data,
        created_by: req.user!.id,
      });
      ok(res, batch, 201);
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
   * /batches/{id}:
   *   put:
   *     summary: Update a batch
   *     tags: [Batches]
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
   *               batch_code:
   *                 type: string
   *               vaccine_id:
   *                 type: string
   *                 format: uuid
   *               expiry_date:
   *                 type: string
   *               closed_bottle_expiry_date:
   *                 type: string
   *               open_bottle_expiry_minutes:
   *                 type: integer
   *               doses_per_bottle:
   *                 type: integer
   *               ml_per_dose:
   *                 type: number
   *     responses:
   *       200:
   *         description: Batch updated
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   *       409:
   *         description: Business rule violation
   *       422:
   *         description: Validation error
   */
  router.put('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = updateBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const batch = await updateBatchUseCase.execute(req.params.id, parsed.data);
      ok(res, batch);
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
   * /batches/{id}:
   *   delete:
   *     summary: Soft delete a batch
   *     tags: [Batches]
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
      await deleteBatchUseCase.execute(req.params.id);
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
