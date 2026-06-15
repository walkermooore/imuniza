import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBulkBottleDiscardUseCase } from '@application/usecases/CreateBulkBottleDiscardUseCase';
import { ListBulkBottleDiscardsUseCase } from '@application/usecases/ListBulkBottleDiscardsUseCase';
import { GetBulkBottleDiscardByIdUseCase } from '@application/usecases/GetBulkBottleDiscardByIdUseCase';
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
  mode: z.enum(['A', 'B']),
  discarded_at: z.string().datetime(),
  discard_reason_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  comment: z.string().optional(),
});

export function createBulkBottleDiscardsRouter(
  tokenService: ITokenService,
  createBulkBottleDiscardUseCase: CreateBulkBottleDiscardUseCase,
  listBulkBottleDiscardsUseCase: ListBulkBottleDiscardsUseCase,
  getBulkBottleDiscardByIdUseCase: GetBulkBottleDiscardByIdUseCase,
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
   * /bulk-bottle-discards:
   *   get:
   *     summary: List bulk bottle discards (paginated, filterable)
   *     tags: [BulkBottleDiscards]
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
   *         description: Paginated list of bulk bottle discards
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
    const result = await listBulkBottleDiscardsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /bulk-bottle-discards/{id}:
   *   get:
   *     summary: Get bulk bottle discard by ID
   *     tags: [BulkBottleDiscards]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Bulk bottle discard found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await getBulkBottleDiscardByIdUseCase.execute(req.params.id);
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
   * /bulk-bottle-discards:
   *   post:
   *     summary: Register a bulk bottle discard
   *     tags: [BulkBottleDiscards]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [batch_entry_id, vaccine_room_id, mode, discarded_at, discard_reason_id, quantity]
   *             properties:
   *               batch_entry_id:
   *                 type: string
   *                 format: uuid
   *               vaccine_room_id:
   *                 type: string
   *                 format: uuid
   *               mode:
   *                 type: string
   *                 enum: [A, B]
   *               discarded_at:
   *                 type: string
   *                 format: date-time
   *               discard_reason_id:
   *                 type: string
   *                 format: uuid
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *               comment:
   *                 type: string
   *     responses:
   *       201:
   *         description: Bulk bottle discard registered
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
    const record = await createBulkBottleDiscardUseCase.execute({
      ...parsed.data,
      created_by: req.user!.id,
    });
    ok(res, record, 201);
  });

  return router;
}
