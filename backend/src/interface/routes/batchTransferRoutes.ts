import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBatchTransferUseCase } from '@application/usecases/CreateBatchTransferUseCase';
import { ListBatchTransfersUseCase } from '@application/usecases/ListBatchTransfersUseCase';
import { GetBatchTransferByIdUseCase } from '@application/usecases/GetBatchTransferByIdUseCase';
import { ResolveBatchTransferUseCase } from '@application/usecases/ResolveBatchTransferUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const listSchema = paginationQuerySchema.extend({
  status: z.enum(['pending', 'accepted', 'rejected', 'expired', 'cancelled']).optional(),
  origin_vaccine_room_id: z.string().uuid().optional(),
  destination_vaccine_room_id: z.string().uuid().optional(),
});

const createSchema = z.object({
  source_batch_entry_id: z.string().uuid(),
  origin_vaccine_room_id: z.string().uuid(),
  destination_vaccine_room_id: z.string().uuid(),
  bottle_count: z.number().int().positive(),
  comment: z.string().optional(),
});

const resolveSchema = z.object({
  action: z.enum(['accept', 'reject', 'cancel']),
});

export function createBatchTransfersRouter(
  tokenService: ITokenService,
  createBatchTransferUseCase: CreateBatchTransferUseCase,
  listBatchTransfersUseCase: ListBatchTransfersUseCase,
  getBatchTransferByIdUseCase: GetBatchTransferByIdUseCase,
  resolveBatchTransferUseCase: ResolveBatchTransferUseCase,
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
   * /batch-transfers:
   *   get:
   *     summary: List batch transfers (paginated, filterable)
   *     tags: [BatchTransfers]
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
   *         name: status
   *         schema: { type: string, enum: [pending, accepted, rejected, expired, cancelled] }
   *       - in: query
   *         name: origin_vaccine_room_id
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: destination_vaccine_room_id
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Paginated list of batch transfers
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
    const result = await listBatchTransfersUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /batch-transfers/{id}:
   *   get:
   *     summary: Get batch transfer by ID
   *     tags: [BatchTransfers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Batch transfer found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await getBatchTransferByIdUseCase.execute(req.params.id);
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
   * /batch-transfers:
   *   post:
   *     summary: Request a batch transfer between rooms
   *     tags: [BatchTransfers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [source_batch_entry_id, origin_vaccine_room_id, destination_vaccine_room_id, bottle_count]
   *             properties:
   *               source_batch_entry_id:
   *                 type: string
   *                 format: uuid
   *               origin_vaccine_room_id:
   *                 type: string
   *                 format: uuid
   *               destination_vaccine_room_id:
   *                 type: string
   *                 format: uuid
   *               bottle_count:
   *                 type: integer
   *                 minimum: 1
   *               comment:
   *                 type: string
   *     responses:
   *       201:
   *         description: Transfer requested
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }
    const record = await createBatchTransferUseCase.execute({
      ...parsed.data,
      requested_by: req.user!.id,
    });
    ok(res, record, 201);
  });

  /**
   * @swagger
   * /batch-transfers/{id}/resolve:
   *   post:
   *     summary: Accept, reject, or cancel a batch transfer
   *     tags: [BatchTransfers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [action]
   *             properties:
   *               action:
   *                 type: string
   *                 enum: [accept, reject, cancel]
   *     responses:
   *       200:
   *         description: Transfer resolved
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
  router.post('/:id/resolve', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }
    try {
      const record = await resolveBatchTransferUseCase.execute({
        id: req.params.id,
        action: parsed.data.action,
        resolved_by: req.user!.id,
      });
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
