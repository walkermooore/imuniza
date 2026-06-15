import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBottleOpeningUseCase } from '@application/usecases/CreateBottleOpeningUseCase';
import { ListBottleOpeningsUseCase } from '@application/usecases/ListBottleOpeningsUseCase';
import { GetBottleOpeningByIdUseCase } from '@application/usecases/GetBottleOpeningByIdUseCase';
import { CancelBottleOpeningUseCase } from '@application/usecases/CancelBottleOpeningUseCase';
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
  vaccine_room_id: z.string().uuid(),
  opened_at: z.string().datetime(),
  comment: z.string().optional(),
  opening_reason_id: z.string().uuid().optional(),
  alert_triggered: z.boolean().default(false),
  bulk_opening_id: z.string().uuid().optional(),
});

export function createBottleOpeningsRouter(
  tokenService: ITokenService,
  createBottleOpeningUseCase: CreateBottleOpeningUseCase,
  listBottleOpeningsUseCase: ListBottleOpeningsUseCase,
  getBottleOpeningByIdUseCase: GetBottleOpeningByIdUseCase,
  cancelBottleOpeningUseCase: CancelBottleOpeningUseCase,
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
   * /bottle-openings:
   *   get:
   *     summary: List bottle openings (paginated, filterable)
   *     tags: [BottleOpenings]
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
   *         description: Paginated list of bottle openings
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
    const result = await listBottleOpeningsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /bottle-openings/{id}:
   *   get:
   *     summary: Get bottle opening by ID
   *     tags: [BottleOpenings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Bottle opening found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await getBottleOpeningByIdUseCase.execute(req.params.id);
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
   * /bottle-openings:
   *   post:
   *     summary: Register a bottle opening
   *     tags: [BottleOpenings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [batch_entry_id, vaccine_room_id, opened_at, alert_triggered]
   *             properties:
   *               batch_entry_id:
   *                 type: string
   *                 format: uuid
   *               vaccine_room_id:
   *                 type: string
   *                 format: uuid
   *               opened_at:
   *                 type: string
   *                 format: date-time
   *               comment:
   *                 type: string
   *               opening_reason_id:
   *                 type: string
   *                 format: uuid
   *               alert_triggered:
   *                 type: boolean
   *               bulk_opening_id:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       201:
   *         description: Bottle opening registered
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
    const record = await createBottleOpeningUseCase.execute({
      ...parsed.data,
      created_by: req.user!.id,
    });
    ok(res, record, 201);
  });

  /**
   * @swagger
   * /bottle-openings/{id}/cancel:
   *   post:
   *     summary: Cancel a bottle opening
   *     tags: [BottleOpenings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Bottle opening cancelled
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
      const record = await cancelBottleOpeningUseCase.execute(req.params.id, req.user!.id);
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
