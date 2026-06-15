import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { LocationType } from '@domain/entities/Location';
import { CreateLocationUseCase } from '@application/usecases/CreateLocationUseCase';
import { ListLocationsUseCase } from '@application/usecases/ListLocationsUseCase';
import { GetLocationByIdUseCase } from '@application/usecases/GetLocationByIdUseCase';
import { UpdateLocationUseCase } from '@application/usecases/UpdateLocationUseCase';
import { DeleteLocationUseCase } from '@application/usecases/DeleteLocationUseCase';
import { createAuthMiddleware } from '@interface/middlewares/authMiddleware';
import { roleGuard } from '@interface/middlewares/roleGuard';
import { ITokenService } from '@domain/services/ITokenService';
import { UserRole } from '@domain/entities/User';
import { NotFoundError, ConflictError } from '@domain/errors';
import { ok, paginated, fail } from '@interface/helpers/response';
import { paginationQuerySchema } from '@interface/routes/schemas/listQuery';

const paginationSchema = paginationQuerySchema;

const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  type: z.nativeEnum(LocationType),
  other_description: z.string().min(1).optional(),
});

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  type: z.nativeEnum(LocationType).optional(),
  other_description: z.string().min(1).nullable().optional(),
});

export function createLocationsRouter(
  tokenService: ITokenService,
  createLocationUseCase: CreateLocationUseCase,
  listLocationsUseCase: ListLocationsUseCase,
  getLocationByIdUseCase: GetLocationByIdUseCase,
  updateLocationUseCase: UpdateLocationUseCase,
  deleteLocationUseCase: DeleteLocationUseCase,
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
   * /locations:
   *   get:
   *     summary: List all active locations (paginated)
   *     tags: [Locations]
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
   *         description: Paginated list of locations
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
    const result = await listLocationsUseCase.execute(parsed.data);
    paginated(res, result);
  });

  /**
   * @swagger
   * /locations/{id}:
   *   get:
   *     summary: Get location by ID
   *     tags: [Locations]
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
   *         description: Location found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Not found
   */
  router.get('/:id', auth, allRoles, async (req: Request, res: Response): Promise<void> => {
    try {
      const location = await getLocationByIdUseCase.execute(req.params.id);
      ok(res, location);
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
   * /locations:
   *   post:
   *     summary: Create a new location
   *     tags: [Locations]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, address, type]
   *             properties:
   *               name:
   *                 type: string
   *               address:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [ubs, lugar_temporario, escola, hospital, outro]
   *               other_description:
   *                 type: string
   *                 description: Required when type is "outro"
   *     responses:
   *       201:
   *         description: Location created
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
    const parsed = createLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const location = await createLocationUseCase.execute({ ...parsed.data, createdBy: req.user!.id });
      ok(res, location, 201);
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
   * /locations/{id}:
   *   put:
   *     summary: Update a location
   *     tags: [Locations]
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
   *               address:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [ubs, lugar_temporario, escola, hospital, outro]
   *               other_description:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Location updated
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
    const parsed = updateLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 'Validation error', 422, parsed.error.format());
      return;
    }

    try {
      const location = await updateLocationUseCase.execute(req.params.id, parsed.data, req.user!.id);
      ok(res, location);
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
   * /locations/{id}:
   *   delete:
   *     summary: Soft delete a location
   *     tags: [Locations]
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
      await deleteLocationUseCase.execute(req.params.id, req.user!.id);
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
