import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBulkBottleOpeningUseCase } from '@application/usecases/CreateBulkBottleOpeningUseCase';
import { ListBulkBottleOpeningsUseCase } from '@application/usecases/ListBulkBottleOpeningsUseCase';
import { GetBulkBottleOpeningByIdUseCase } from '@application/usecases/GetBulkBottleOpeningByIdUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError } from '@domain/errors';
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
  quantity: z.number().int().positive(),
  comment: z.string().optional(),
  opening_reason_id: z.string().uuid().optional(),
  alert_triggered: z.boolean().default(false),
});

export function createBulkBottleOpeningsRouter(
  tokenService: ITokenService,
  createBulkBottleOpeningUseCase: CreateBulkBottleOpeningUseCase,
  listBulkBottleOpeningsUseCase: ListBulkBottleOpeningsUseCase,
  getBulkBottleOpeningByIdUseCase: GetBulkBottleOpeningByIdUseCase,
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
   * /bulk-bottle-openings:
   *   get:
   *     summary: List bulk bottle openings (paginated, filterable)
   *     tags: [BulkBottleOpenings]
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
   *         description: Paginated list of bulk bottle openings
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
    const result = await listBulkBottleOpeningsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /bulk-bottle-openings/{id}:
   *   get:
   *     summary: Get bulk bottle opening by ID
   *     tags: [BulkBottleOpenings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Bulk bottle opening found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await getBulkBottleOpeningByIdUseCase.execute(req.params.id);
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
   * /bulk-bottle-openings:
   *   post:
   *     summary: Register a bulk bottle opening
   *     tags: [BulkBottleOpenings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [batch_entry_id, vaccine_room_id, opened_at, quantity, alert_triggered]
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
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *               comment:
   *                 type: string
   *               opening_reason_id:
   *                 type: string
   *                 format: uuid
   *               alert_triggered:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Bulk bottle opening registered
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
    const record = await createBulkBottleOpeningUseCase.execute({
      ...parsed.data,
      created_by: req.user!.id,
    });
    ok(res, record, 201);
  });

  return router;
}
