import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBottleDiscardUseCase } from '@application/usecases/CreateBottleDiscardUseCase';
import { ListBottleDiscardsUseCase } from '@application/usecases/ListBottleDiscardsUseCase';
import { GetBottleDiscardByIdUseCase } from '@application/usecases/GetBottleDiscardByIdUseCase';
import { CancelBottleDiscardUseCase } from '@application/usecases/CancelBottleDiscardUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const listSchema = paginationQuerySchema.extend({
  vaccine_room_id: z.string().uuid().optional(),
  batch_entry_id: z.string().uuid().optional(),
});

const createSchema = z.object({
  batch_entry_id: z.string().uuid(),
  bottle_opening_id: z.string().uuid().optional(),
  discarded_at: z.string().datetime(),
  discard_reason_id: z.string().uuid(),
  remaining_doses: z.number().int().min(0).optional(),
  comment: z.string().optional(),
  bulk_discard_id: z.string().uuid().optional(),
  vaccine_room_id: z.string().uuid().optional(),
});

export function createBottleDiscardsRouter(
  tokenService: ITokenService,
  createBottleDiscardUseCase: CreateBottleDiscardUseCase,
  listBottleDiscardsUseCase: ListBottleDiscardsUseCase,
  getBottleDiscardByIdUseCase: GetBottleDiscardByIdUseCase,
  cancelBottleDiscardUseCase: CancelBottleDiscardUseCase,
): Router {
  const router = Router();
  const auth = createAuthMiddleware(tokenService);
  const allRoles = roleGuard([
    UserRole.administrador,
    UserRole.gestor,
    UserRole.tecnico,
  ]);

  /**
   * @swagger
   * /bottle-discards:
   *   get:
   *     summary: List bottle discards (paginated, filterable)
   *     tags: [BottleDiscards]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: page_size
   *         schema: { type: integer, default: 20, maximum: 100 }
   *       - in: query
   *         name: vaccine_room_id
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: batch_entry_id
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Paginated list of bottle discards
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Invalid query params
   */
  router.get('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid query params', 422, parsed.error.format());
      return;
    }
    const result = await listBottleDiscardsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /bottle-discards/{id}:
   *   get:
   *     summary: Get bottle discard by ID
   *     tags: [BottleDiscards]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Bottle discard found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await getBottleDiscardByIdUseCase.execute(req.params.id);
      ok(res, record);
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
   * /bottle-discards:
   *   post:
   *     summary: Register a bottle discard
   *     tags: [BottleDiscards]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [batch_entry_id, discarded_at, discard_reason_id]
   *             properties:
   *               batch_entry_id:
   *                 type: string
   *                 format: uuid
   *               bottle_opening_id:
   *                 type: string
   *                 format: uuid
   *               discarded_at:
   *                 type: string
   *                 format: date-time
   *               discard_reason_id:
   *                 type: string
   *                 format: uuid
   *               remaining_doses:
   *                 type: integer
   *                 minimum: 0
   *               comment:
   *                 type: string
   *               bulk_discard_id:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       201:
   *         description: Bottle discard registered
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }
    const record = await createBottleDiscardUseCase.execute({
      ...parsed.data,
      created_by: req.user!.id,
    });
    ok(res, record, 201);
  });

  /**
   * @swagger
   * /bottle-discards/{id}/cancel:
   *   post:
   *     summary: Cancel a bottle discard
   *     tags: [BottleDiscards]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Bottle discard cancelled
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   *       409:
   *         description: Already cancelled
   */
  router.post('/:id/cancel', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await cancelBottleDiscardUseCase.execute(req.params.id, req.user!.id);
      ok(res, record);
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

  return router;
}
