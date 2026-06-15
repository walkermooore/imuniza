import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateBatchRoomEntryUseCase } from '@application/usecases/CreateBatchRoomEntryUseCase';
import { ListBatchRoomEntriesUseCase } from '@application/usecases/ListBatchRoomEntriesUseCase';
import { GetBatchRoomEntryByIdUseCase } from '@application/usecases/GetBatchRoomEntryByIdUseCase';
import { DeleteBatchRoomEntryUseCase } from '@application/usecases/DeleteBatchRoomEntryUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema.extend({
  batch_id: z.string().uuid().optional(),
  vaccine_room_id: z.string().uuid().optional(),
});

const createBatchRoomEntrySchema = z.object({
  batch_id: z.string().uuid(),
  vaccine_room_id: z.string().uuid(),
  bottle_count: z.number().int().positive(),
  source_batch_entry_id: z.string().uuid().optional(),
});

export function createBatchRoomEntriesRouter(
  tokenService: ITokenService,
  createBatchRoomEntryUseCase: CreateBatchRoomEntryUseCase,
  listBatchRoomEntriesUseCase: ListBatchRoomEntriesUseCase,
  getBatchRoomEntryByIdUseCase: GetBatchRoomEntryByIdUseCase,
  deleteBatchRoomEntryUseCase: DeleteBatchRoomEntryUseCase,
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
   * /batch-room-entries:
   *   get:
   *     summary: List all active batch room entries (paginated, filterable)
   *     tags: [BatchRoomEntries]
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
   *       - in: query
   *         name: batch_id
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: vaccine_room_id
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Paginated list of batch room entries
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Invalid query params
   */
  router.get('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid query params', 422, parsed.error.format());
      return;
    }
    const result = await listBatchRoomEntriesUseCase.execute({
      ...parsed.data,
      user: { id: req.user!.id, role: req.user!.role },
    });
    paginated(res, result);
  });

  /**
   * @swagger
   * /batch-room-entries/{id}:
   *   get:
   *     summary: Get batch room entry by ID
   *     tags: [BatchRoomEntries]
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
   *         description: Batch room entry found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const entry = await getBatchRoomEntryByIdUseCase.execute(req.params.id);
      ok(res, entry);
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
   * /batch-room-entries:
   *   post:
   *     summary: Create a new batch room entry
   *     tags: [BatchRoomEntries]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [batch_id, vaccine_room_id, bottle_count]
   *             properties:
   *               batch_id:
   *                 type: string
   *                 format: uuid
   *               vaccine_room_id:
   *                 type: string
   *                 format: uuid
   *               bottle_count:
   *                 type: integer
   *                 minimum: 1
   *               source_batch_entry_id:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       201:
   *         description: Batch room entry created
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
    const parsed = createBatchRoomEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const entry = await createBatchRoomEntryUseCase.execute({
        ...parsed.data,
        created_by: req.user!.id,
        user: { id: req.user!.id, role: req.user!.role },
      });
      ok(res, entry, 201);
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
   * /batch-room-entries/{id}:
   *   delete:
   *     summary: Soft delete a batch room entry
   *     tags: [BatchRoomEntries]
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
      await deleteBatchRoomEntryUseCase.execute({
        id: req.params.id,
        user: { id: req.user!.id, role: req.user!.role },
      });
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
