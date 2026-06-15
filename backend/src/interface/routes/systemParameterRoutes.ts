import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ListSystemParametersUseCase } from '@application/usecases/ListSystemParametersUseCase';
import { GetSystemParameterUseCase } from '@application/usecases/GetSystemParameterUseCase';
import { UpdateSystemParameterUseCase } from '@application/usecases/UpdateSystemParameterUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { buildMeta } from '@domain/shared/Pagination';
import { searchQuerySchema } from '@interface/routes/schemas/listQuery';

const updateSystemParameterSchema = z.object({
  value: z.string().min(1),
});

const listQuerySchema = z.object({
  search: searchQuerySchema,
});

export function createSystemParametersRouter(
  tokenService: ITokenService,
  listSystemParametersUseCase: ListSystemParametersUseCase,
  getSystemParameterUseCase: GetSystemParameterUseCase,
  updateSystemParameterUseCase: UpdateSystemParameterUseCase,
): Router {
  const router = Router();
  const auth = createAuthMiddleware(tokenService);
  const allRoles = roleGuard([
    UserRole.administrador,
    UserRole.gestor,
    UserRole.tecnico,
  ]);
  const adminOnly = roleGuard([UserRole.administrador]);

  /**
   * @swagger
   * /system-parameters:
   *   get:
   *     summary: List all system parameters
   *     tags: [SystemParameters]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Paginated list of system parameters
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
    const data = await listSystemParametersUseCase.execute(parsed.data.search);
    paginated(res, { data, meta: buildMeta(1, data.length || 1, data.length) });
  });

  /**
   * @swagger
   * /system-parameters/{id}:
   *   get:
   *     summary: Get system parameter by ID
   *     tags: [SystemParameters]
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
   *         description: System parameter found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const param = await getSystemParameterUseCase.execute(req.params.id);
      ok(res, param);
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
   * /system-parameters/{id}:
   *   put:
   *     summary: Update system parameter value (admin only)
   *     tags: [SystemParameters]
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
   *             required: [value]
   *             properties:
   *               value:
   *                 type: string
   *                 minLength: 1
   *     responses:
   *       200:
   *         description: System parameter updated
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   *       422:
   *         description: Validation error
   */
  router.put('/:id', auth, adminOnly, async (req: Request, res: Response): Promise<void> => {
    const parsed = updateSystemParameterSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const param = await updateSystemParameterUseCase.execute({
        id: req.params.id,
        value: parsed.data.value,
        updatedBy: req.user!.id,
      });
      ok(res, param);
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
