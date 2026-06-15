import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateVaccineRoomUseCase } from '@application/usecases/CreateVaccineRoomUseCase';
import { ListVaccineRoomsUseCase } from '@application/usecases/ListVaccineRoomsUseCase';
import { GetVaccineRoomByIdUseCase } from '@application/usecases/GetVaccineRoomByIdUseCase';
import { UpdateVaccineRoomUseCase } from '@application/usecases/UpdateVaccineRoomUseCase';
import { DeleteVaccineRoomUseCase } from '@application/usecases/DeleteVaccineRoomUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema.extend({
  location_id: z.string().uuid().optional(),
});

const createVaccineRoomSchema = z.object({
  location_id: z.string().uuid(),
  description: z.string().min(1),
});

const updateVaccineRoomSchema = z.object({
  description: z.string().min(1).optional(),
});

export function createVaccineRoomsRouter(
  tokenService: ITokenService,
  createVaccineRoomUseCase: CreateVaccineRoomUseCase,
  listVaccineRoomsUseCase: ListVaccineRoomsUseCase,
  getVaccineRoomByIdUseCase: GetVaccineRoomByIdUseCase,
  updateVaccineRoomUseCase: UpdateVaccineRoomUseCase,
  deleteVaccineRoomUseCase: DeleteVaccineRoomUseCase,
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
   * /vaccine-rooms:
   *   get:
   *     summary: List all active vaccine rooms (paginated)
   *     tags: [VaccineRooms]
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
   *         name: location_id
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter by location
   *     responses:
   *       200:
   *         description: Paginated list of vaccine rooms
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Invalid params
   */
  router.get('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid pagination params', 422, parsed.error.format());
      return;
    }
    const result = await listVaccineRoomsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /vaccine-rooms/{id}:
   *   get:
   *     summary: Get vaccine room by ID
   *     tags: [VaccineRooms]
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
   *         description: Vaccine room found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const room = await getVaccineRoomByIdUseCase.execute(req.params.id);
      ok(res, room);
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
   * /vaccine-rooms:
   *   post:
   *     summary: Create a new vaccine room
   *     tags: [VaccineRooms]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [location_id, description]
   *             properties:
   *               location_id:
   *                 type: string
   *                 format: uuid
   *               description:
   *                 type: string
   *     responses:
   *       201:
   *         description: Vaccine room created
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = createVaccineRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    const room = await createVaccineRoomUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
    ok(res, room, 201);
  });

  /**
   * @swagger
   * /vaccine-rooms/{id}:
   *   put:
   *     summary: Update a vaccine room
   *     tags: [VaccineRooms]
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
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Vaccine room updated
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   *       422:
   *         description: Validation error
   */
  router.put('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = updateVaccineRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const room = await updateVaccineRoomUseCase.execute(req.params.id, parsed.data, req.user!.id);
      ok(res, room);
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
   * /vaccine-rooms/{id}:
   *   delete:
   *     summary: Soft delete a vaccine room
   *     tags: [VaccineRooms]
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
      await deleteVaccineRoomUseCase.execute(req.params.id, req.user!.id);
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
