import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ListNotificationLocationOverridesUseCase } from '@application/usecases/ListNotificationLocationOverridesUseCase';
import { CreateNotificationLocationOverrideUseCase } from '@application/usecases/CreateNotificationLocationOverrideUseCase';
import { UpdateNotificationLocationOverrideUseCase } from '@application/usecases/UpdateNotificationLocationOverrideUseCase';
import { DeleteNotificationLocationOverrideUseCase } from '@application/usecases/DeleteNotificationLocationOverrideUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, fail } from '@interface/helpers/response';
import { searchQuerySchema } from '@interface/routes/schemas/listQuery';

const createSchema = z.object({
  event_config_id: z.string().uuid(),
  location_id: z.string().uuid(),
  is_enabled: z.boolean(),
});

const updateSchema = z.object({
  is_enabled: z.boolean(),
});

const listQuerySchema = z.object({
  search: searchQuerySchema,
});

export function createNotificationLocationOverridesRouter(
  tokenService: ITokenService,
  listUseCase: ListNotificationLocationOverridesUseCase,
  createUseCase: CreateNotificationLocationOverrideUseCase,
  updateUseCase: UpdateNotificationLocationOverrideUseCase,
  deleteUseCase: DeleteNotificationLocationOverrideUseCase,
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
   * /notification-location-overrides:
   *   get:
   *     summary: List all notification location overrides
   *     tags: [NotificationLocationOverrides]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of notification location overrides
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   */
  router.get('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid query params', 422, parsed.error.format());
      return;
    }
    const overrides = await listUseCase.execute(parsed.data.search);
    ok(res, overrides);
  });

  /**
   * @swagger
   * /notification-location-overrides:
   *   post:
   *     summary: Create a notification location override (admin only)
   *     tags: [NotificationLocationOverrides]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [event_config_id, location_id, is_enabled]
   *             properties:
   *               event_config_id:
   *                 type: string
   *                 format: uuid
   *               location_id:
   *                 type: string
   *                 format: uuid
   *               is_enabled:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Override created
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       409:
   *         description: Override already exists for this location and event type
   *       422:
   *         description: Validation error
   */
  router.post('/', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const override = await createUseCase.execute({
        ...parsed.data,
        created_by: req.user!.id,
      });
      ok(res, override, 201);
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
   * /notification-location-overrides/{id}:
   *   put:
   *     summary: Update a notification location override (admin only)
   *     tags: [NotificationLocationOverrides]
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
   *             required: [is_enabled]
   *             properties:
   *               is_enabled:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Override updated
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
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const updated = await updateUseCase.execute({
        id: req.params.id,
        is_enabled: parsed.data.is_enabled,
      });
      ok(res, updated);
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
   * /notification-location-overrides/{id}:
   *   delete:
   *     summary: Delete a notification location override (admin only)
   *     tags: [NotificationLocationOverrides]
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
   *         description: Override deleted
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.delete('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      await deleteUseCase.execute(req.params.id);
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
