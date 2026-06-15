import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ListNotificationEventConfigsUseCase } from '@application/usecases/ListNotificationEventConfigsUseCase';
import { UpdateNotificationEventConfigUseCase } from '@application/usecases/UpdateNotificationEventConfigUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError } from '@domain/errors';
import { ok, fail } from '@interface/helpers/response';
import { searchQuerySchema } from '@interface/routes/schemas/listQuery';

const updateSchema = z.object({
  is_enabled: z.boolean(),
});

const listQuerySchema = z.object({
  search: searchQuerySchema,
});

export function createNotificationEventConfigsRouter(
  tokenService: ITokenService,
  listUseCase: ListNotificationEventConfigsUseCase,
  updateUseCase: UpdateNotificationEventConfigUseCase,
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
   * /notification-event-configs:
   *   get:
   *     summary: List all notification event configs
   *     tags: [NotificationEventConfigs]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of notification event configs
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
    const configs = await listUseCase.execute(parsed.data.search);
    ok(res, configs);
  });

  /**
   * @swagger
   * /notification-event-configs/{id}:
   *   put:
   *     summary: Update notification event config (admin only)
   *     tags: [NotificationEventConfigs]
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
   *         description: Notification event config updated
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
        updated_by: req.user!.id,
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

  return router;
}
