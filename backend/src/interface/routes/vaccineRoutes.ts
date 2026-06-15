import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateVaccineUseCase } from '@application/usecases/CreateVaccineUseCase';
import { ListVaccinesUseCase } from '@application/usecases/ListVaccinesUseCase';
import { GetVaccineByIdUseCase } from '@application/usecases/GetVaccineByIdUseCase';
import { UpdateVaccineUseCase } from '@application/usecases/UpdateVaccineUseCase';
import { DeleteVaccineUseCase } from '@application/usecases/DeleteVaccineUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema;

const createVaccineSchema = z.object({
  name: z.string().min(1),
  laboratory_id: z.string().uuid(),
});

const updateVaccineSchema = z.object({
  name: z.string().min(1).optional(),
  laboratory_id: z.string().uuid().optional(),
});

export function createVaccinesRouter(
  tokenService: ITokenService,
  createVaccineUseCase: CreateVaccineUseCase,
  listVaccinesUseCase: ListVaccinesUseCase,
  getVaccineByIdUseCase: GetVaccineByIdUseCase,
  updateVaccineUseCase: UpdateVaccineUseCase,
  deleteVaccineUseCase: DeleteVaccineUseCase,
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
   * /vaccines:
   *   get:
   *     summary: List all active vaccines (paginated)
   *     tags: [Vaccines]
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
   *         description: Paginated list of vaccines
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
    const result = await listVaccinesUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /vaccines/{id}:
   *   get:
   *     summary: Get vaccine by ID
   *     tags: [Vaccines]
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
   *         description: Vaccine found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const vaccine = await getVaccineByIdUseCase.execute(req.params.id);
      ok(res, vaccine);
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
   * /vaccines:
   *   post:
   *     summary: Create a new vaccine
   *     tags: [Vaccines]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, laboratory_id]
   *             properties:
   *               name:
   *                 type: string
   *               laboratory_id:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       201:
   *         description: Vaccine created
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
    const parsed = createVaccineSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const vaccine = await createVaccineUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
      ok(res, vaccine, 201);
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
   * /vaccines/{id}:
   *   put:
   *     summary: Update a vaccine
   *     tags: [Vaccines]
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
   *               laboratory_id:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       200:
   *         description: Vaccine updated
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
    const parsed = updateVaccineSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const vaccine = await updateVaccineUseCase.execute(req.params.id, parsed.data, req.user!.id);
      ok(res, vaccine);
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
   * /vaccines/{id}:
   *   delete:
   *     summary: Soft delete a vaccine
   *     tags: [Vaccines]
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
      await deleteVaccineUseCase.execute(req.params.id);
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
