import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ListNotificationsUseCase } from '@application/usecases/ListNotificationsUseCase';
import { MarkNotificationReadUseCase } from '@application/usecases/MarkNotificationReadUseCase';
import { MarkAllNotificationsReadUseCase } from '@application/usecases/MarkAllNotificationsReadUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const listQuerySchema = paginationQuerySchema;

export function createNotificationsRouter(
  tokenService: ITokenService,
  listUseCase: ListNotificationsUseCase,
  markReadUseCase: MarkNotificationReadUseCase,
  markAllReadUseCase: MarkAllNotificationsReadUseCase,
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
   * /notifications:
   *   get:
   *     summary: List notifications for the authenticated user (paginated)
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: page_size
   *         schema: { type: integer, default: 20, maximum: 100 }
   *     responses:
   *       200:
   *         description: Paginated list of notifications with resolved description
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Invalid query params
   */
  router.get('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid query params', 422, parsed.error.format());
      return;
    }
    const result = await listUseCase.execute({
      user_id: req.user!.id,
      page: parsed.data.page,
      page_size: parsed.data.page_size,
      search: parsed.data.search,
    });
    paginated(res, result);
  });

  /**
   * @swagger
   * /notifications/read-all:
   *   put:
   *     summary: Mark all notifications as read for the authenticated user
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: All notifications marked as read
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   */
  // IMPORTANT: registered BEFORE /:id/read so Express doesn't treat 'read-all' as :id
  router.put('/read-all', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    await markAllReadUseCase.execute({ user_id: req.user!.id });
    ok(res, null);
  });

  /**
   * @swagger
   * /notifications/{id}/read:
   *   put:
   *     summary: Mark a specific notification as read
   *     tags: [Notifications]
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
   *         description: Notification marked as read
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found or not owned by user
   */
  router.put('/:id/read', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const updated = await markReadUseCase.execute({
        id: req.params.id,
        user_id: req.user!.id,
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
