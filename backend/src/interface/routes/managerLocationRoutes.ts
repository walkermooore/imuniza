import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AssignManagerLocationUseCase } from '@application/usecases/AssignManagerLocationUseCase';
import { ListManagerLocationsUseCase } from '@application/usecases/ListManagerLocationsUseCase';
import { GetManagerLocationByIdUseCase } from '@application/usecases/GetManagerLocationByIdUseCase';
import { RemoveManagerLocationUseCase } from '@application/usecases/RemoveManagerLocationUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const listSchema = paginationQuerySchema.extend({
  user_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
});

const assignSchema = z.object({
  user_id: z.string().uuid(),
  location_id: z.string().uuid(),
});

export function createManagerLocationsRouter(
  tokenService: ITokenService,
  assignManagerLocationUseCase: AssignManagerLocationUseCase,
  listManagerLocationsUseCase: ListManagerLocationsUseCase,
  getManagerLocationByIdUseCase: GetManagerLocationByIdUseCase,
  removeManagerLocationUseCase: RemoveManagerLocationUseCase,
): Router {
  const router = Router();
  const auth = createAuthMiddleware(tokenService);
  const allRoles = roleGuard([
    UserRole.administrador,
    UserRole.gestor,
    UserRole.tecnico,
  ]);
  const adminRoles = roleGuard([UserRole.administrador]);

  /**
   * @swagger
   * /manager-locations:
   *   get:
   *     summary: List active manager-location assignments (paginated, filterable)
   *     tags: [ManagerLocations]
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
   *         name: location_id
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Paginated list of manager-location assignments
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
    const result = await listManagerLocationsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /manager-locations/{id}:
   *   get:
   *     summary: Get manager-location assignment by ID
   *     tags: [ManagerLocations]
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
      const record = await getManagerLocationByIdUseCase.execute(req.params.id);
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
   * /manager-locations:
   *   post:
   *     summary: Assign a manager to a location
   *     tags: [ManagerLocations]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [user_id, location_id]
   *             properties:
   *               user_id:
   *                 type: string
   *                 format: uuid
   *               location_id:
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
  router.post('/', auth, adminRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }
    try {
      const record = await assignManagerLocationUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
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
   * /manager-locations/{id}:
   *   delete:
   *     summary: Remove a manager-location assignment
   *     tags: [ManagerLocations]
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
  router.delete('/:id', auth, adminRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      await removeManagerLocationUseCase.execute(req.params.id);
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
