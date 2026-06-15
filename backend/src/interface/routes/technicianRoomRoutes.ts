import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AssignTechnicianRoomUseCase } from '@application/usecases/AssignTechnicianRoomUseCase';
import { ListTechnicianRoomsUseCase } from '@application/usecases/ListTechnicianRoomsUseCase';
import { GetTechnicianRoomByIdUseCase } from '@application/usecases/GetTechnicianRoomByIdUseCase';
import { RemoveTechnicianRoomUseCase } from '@application/usecases/RemoveTechnicianRoomUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const listSchema = paginationQuerySchema.extend({
  user_id: z.string().uuid().optional(),
  vaccine_room_id: z.string().uuid().optional(),
});

const assignSchema = z.object({
  user_id: z.string().uuid(),
  vaccine_room_id: z.string().uuid(),
});

export function createTechnicianRoomsRouter(
  tokenService: ITokenService,
  assignTechnicianRoomUseCase: AssignTechnicianRoomUseCase,
  listTechnicianRoomsUseCase: ListTechnicianRoomsUseCase,
  getTechnicianRoomByIdUseCase: GetTechnicianRoomByIdUseCase,
  removeTechnicianRoomUseCase: RemoveTechnicianRoomUseCase,
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
   * /technician-rooms:
   *   get:
   *     summary: List active technician-room assignments (paginated, filterable)
   *     tags: [TechnicianRooms]
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
   *         name: user_id
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: vaccine_room_id
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Paginated list of technician-room assignments
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
    const result = await listTechnicianRoomsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /technician-rooms/{id}:
   *   get:
   *     summary: Get technician-room assignment by ID
   *     tags: [TechnicianRooms]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Assignment found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await getTechnicianRoomByIdUseCase.execute(req.params.id);
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
   * /technician-rooms:
   *   post:
   *     summary: Assign a technician to a vaccine room
   *     tags: [TechnicianRooms]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [user_id, vaccine_room_id]
   *             properties:
   *               user_id:
   *                 type: string
   *                 format: uuid
   *               vaccine_room_id:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       201:
   *         description: Assignment created
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       409:
   *         description: Already assigned
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }
    try {
      const record = await assignTechnicianRoomUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
      ok(res, record, 201);
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
   * /technician-rooms/{id}:
   *   delete:
   *     summary: Remove a technician-room assignment
   *     tags: [TechnicianRooms]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Assignment removed
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.delete('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      await removeTechnicianRoomUseCase.execute(req.params.id);
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
