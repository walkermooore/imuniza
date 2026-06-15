import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateLaboratoryUseCase } from '@application/usecases/CreateLaboratoryUseCase';
import { ListLaboratoriesUseCase } from '@application/usecases/ListLaboratoriesUseCase';
import { GetLaboratoryByIdUseCase } from '@application/usecases/GetLaboratoryByIdUseCase';
import { UpdateLaboratoryUseCase } from '@application/usecases/UpdateLaboratoryUseCase';
import { DeleteLaboratoryUseCase } from '@application/usecases/DeleteLaboratoryUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema;

const createLaboratorySchema = z.object({
  name: z.string().min(1),
});

const updateLaboratorySchema = z.object({
  name: z.string().min(1).optional(),
});

export function createLaboratoriesRouter(
  tokenService: ITokenService,
  createLaboratoryUseCase: CreateLaboratoryUseCase,
  listLaboratoriesUseCase: ListLaboratoriesUseCase,
  getLaboratoryByIdUseCase: GetLaboratoryByIdUseCase,
  updateLaboratoryUseCase: UpdateLaboratoryUseCase,
  deleteLaboratoryUseCase: DeleteLaboratoryUseCase,
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
   * /laboratories:
   *   get:
   *     summary: List all active laboratories (paginated)
   *     tags: [Laboratories]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number (starts at 1)
   *       - in: query
   *         name: page_size
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: Number of items per page
   *     responses:
   *       200:
   *         description: Paginated list of laboratories
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       422:
   *         description: Invalid pagination params
   */
  router.get('/', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, 'Invalid pagination params', 422, parsed.error.format());
      return;
    }
    const result = await listLaboratoriesUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /laboratories/{id}:
   *   get:
   *     summary: Get laboratory by ID
   *     tags: [Laboratories]
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
   *         description: Laboratory found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const laboratory = await getLaboratoryByIdUseCase.execute(req.params.id);
      ok(res, laboratory);
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
   * /laboratories:
   *   post:
   *     summary: Create a new laboratory
   *     tags: [Laboratories]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Laboratory created
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
    const parsed = createLaboratorySchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const laboratory = await createLaboratoryUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
      ok(res, laboratory, 201);
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
   * /laboratories/{id}:
   *   put:
   *     summary: Update a laboratory
   *     tags: [Laboratories]
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
   *               name:
   *                 type: string
   *     responses:
   *       200:
   *         description: Laboratory updated
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
  router.put('/:id', auth, managerRoles, async (req: Request, res: Response): Promise<void> => {
    const parsed = updateLaboratorySchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const laboratory = await updateLaboratoryUseCase.execute(req.params.id, parsed.data, req.user!.id);
      ok(res, laboratory);
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

  /**
   * @swagger
   * /laboratories/{id}:
   *   delete:
   *     summary: Soft delete a laboratory
   *     tags: [Laboratories]
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
      await deleteLaboratoryUseCase.execute(req.params.id);
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
