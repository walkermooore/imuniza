import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';

import { env } from '@main/config/env';
import { swaggerSpec } from '@main/swagger';
import { pool } from '@infrastructure/database/connection';

// Repositories
import { PgUserRepository } from '@infrastructure/repositories/PgUserRepository';
import { PgLocationRepository } from '@infrastructure/repositories/PgLocationRepository';
import { PgVaccineRoomRepository } from '@infrastructure/repositories/PgVaccineRoomRepository';
import { PgLaboratoryRepository } from '@infrastructure/repositories/PgLaboratoryRepository';
import { PgVaccineRepository } from '@infrastructure/repositories/PgVaccineRepository';
import { PgBatchRepository } from '@infrastructure/repositories/PgBatchRepository';
import { PgBatchRoomEntryRepository } from '@infrastructure/repositories/PgBatchRoomEntryRepository';
import { PgBatchTransferRepository } from '@infrastructure/repositories/PgBatchTransferRepository';
import { PgBottleOpeningReasonRepository } from '@infrastructure/repositories/PgBottleOpeningReasonRepository';
import { PgBottleDiscardReasonRepository } from '@infrastructure/repositories/PgBottleDiscardReasonRepository';
import { PgBottleOpeningRepository } from '@infrastructure/repositories/PgBottleOpeningRepository';
import { PgBottleDiscardRepository } from '@infrastructure/repositories/PgBottleDiscardRepository';
import { PgBulkBottleOpeningRepository } from '@infrastructure/repositories/PgBulkBottleOpeningRepository';
import { PgBulkBottleDiscardRepository } from '@infrastructure/repositories/PgBulkBottleDiscardRepository';
import { PgManagerLocationRepository } from '@infrastructure/repositories/PgManagerLocationRepository';
import { PgTechnicianRoomRepository } from '@infrastructure/repositories/PgTechnicianRoomRepository';
import { PgSystemParameterRepository } from '@infrastructure/repositories/PgSystemParameterRepository';
import { PgNotificationEventConfigRepository } from '@infrastructure/repositories/PgNotificationEventConfigRepository';
import { PgNotificationLocationOverrideRepository } from '@infrastructure/repositories/PgNotificationLocationOverrideRepository';
import { PgNotificationRepository } from '@infrastructure/repositories/PgNotificationRepository';

// Services
import { PermissionService } from '@domain/services/PermissionService';

// Application services
import { NotificationDispatchService } from '@application/services/NotificationDispatchService';

// Services
import { BcryptPasswordService } from '@infrastructure/services/BcryptPasswordService';
import { JwtTokenService } from '@infrastructure/services/JwtTokenService';
import { InMemoryRateLimiterService } from '@infrastructure/services/InMemoryRateLimiterService';

// Use cases — auth & users
import { LoginUseCase } from '@application/usecases/LoginUseCase';
import { CreateUserUseCase } from '@application/usecases/CreateUserUseCase';
import { ListUsersUseCase } from '@application/usecases/ListUsersUseCase';
import { GetUserByIdUseCase } from '@application/usecases/GetUserByIdUseCase';
import { UpdateUserUseCase } from '@application/usecases/UpdateUserUseCase';
import { DeleteUserUseCase } from '@application/usecases/DeleteUserUseCase';

// Use cases — locations
import { CreateLocationUseCase } from '@application/usecases/CreateLocationUseCase';
import { ListLocationsUseCase } from '@application/usecases/ListLocationsUseCase';
import { GetLocationByIdUseCase } from '@application/usecases/GetLocationByIdUseCase';
import { UpdateLocationUseCase } from '@application/usecases/UpdateLocationUseCase';
import { DeleteLocationUseCase } from '@application/usecases/DeleteLocationUseCase';

// Use cases — vaccine rooms
import { CreateVaccineRoomUseCase } from '@application/usecases/CreateVaccineRoomUseCase';
import { ListVaccineRoomsUseCase } from '@application/usecases/ListVaccineRoomsUseCase';
import { GetVaccineRoomByIdUseCase } from '@application/usecases/GetVaccineRoomByIdUseCase';
import { UpdateVaccineRoomUseCase } from '@application/usecases/UpdateVaccineRoomUseCase';
import { DeleteVaccineRoomUseCase } from '@application/usecases/DeleteVaccineRoomUseCase';

// Use cases — laboratories
import { CreateLaboratoryUseCase } from '@application/usecases/CreateLaboratoryUseCase';
import { ListLaboratoriesUseCase } from '@application/usecases/ListLaboratoriesUseCase';
import { GetLaboratoryByIdUseCase } from '@application/usecases/GetLaboratoryByIdUseCase';
import { UpdateLaboratoryUseCase } from '@application/usecases/UpdateLaboratoryUseCase';
import { DeleteLaboratoryUseCase } from '@application/usecases/DeleteLaboratoryUseCase';

// Use cases — vaccines
import { CreateVaccineUseCase } from '@application/usecases/CreateVaccineUseCase';
import { ListVaccinesUseCase } from '@application/usecases/ListVaccinesUseCase';
import { GetVaccineByIdUseCase } from '@application/usecases/GetVaccineByIdUseCase';
import { UpdateVaccineUseCase } from '@application/usecases/UpdateVaccineUseCase';
import { DeleteVaccineUseCase } from '@application/usecases/DeleteVaccineUseCase';

// Use cases — batches
import { CreateBatchUseCase } from '@application/usecases/CreateBatchUseCase';
import { ListBatchesUseCase } from '@application/usecases/ListBatchesUseCase';
import { GetBatchByIdUseCase } from '@application/usecases/GetBatchByIdUseCase';
import { UpdateBatchUseCase } from '@application/usecases/UpdateBatchUseCase';
import { DeleteBatchUseCase } from '@application/usecases/DeleteBatchUseCase';

// Use cases — batch room entries
import { CreateBatchRoomEntryUseCase } from '@application/usecases/CreateBatchRoomEntryUseCase';
import { ListBatchRoomEntriesUseCase } from '@application/usecases/ListBatchRoomEntriesUseCase';
import { GetBatchRoomEntryByIdUseCase } from '@application/usecases/GetBatchRoomEntryByIdUseCase';
import { DeleteBatchRoomEntryUseCase } from '@application/usecases/DeleteBatchRoomEntryUseCase';

// Use cases — batch transfers
import { CreateBatchTransferUseCase } from '@application/usecases/CreateBatchTransferUseCase';
import { ListBatchTransfersUseCase } from '@application/usecases/ListBatchTransfersUseCase';
import { GetBatchTransferByIdUseCase } from '@application/usecases/GetBatchTransferByIdUseCase';
import { ResolveBatchTransferUseCase } from '@application/usecases/ResolveBatchTransferUseCase';

// Use cases — bottle opening reasons
import { CreateBottleOpeningReasonUseCase } from '@application/usecases/CreateBottleOpeningReasonUseCase';
import { ListBottleOpeningReasonsUseCase } from '@application/usecases/ListBottleOpeningReasonsUseCase';
import { GetBottleOpeningReasonByIdUseCase } from '@application/usecases/GetBottleOpeningReasonByIdUseCase';
import { UpdateBottleOpeningReasonUseCase } from '@application/usecases/UpdateBottleOpeningReasonUseCase';
import { DeleteBottleOpeningReasonUseCase } from '@application/usecases/DeleteBottleOpeningReasonUseCase';

// Use cases — bottle discard reasons
import { CreateBottleDiscardReasonUseCase } from '@application/usecases/CreateBottleDiscardReasonUseCase';
import { ListBottleDiscardReasonsUseCase } from '@application/usecases/ListBottleDiscardReasonsUseCase';
import { GetBottleDiscardReasonByIdUseCase } from '@application/usecases/GetBottleDiscardReasonByIdUseCase';
import { UpdateBottleDiscardReasonUseCase } from '@application/usecases/UpdateBottleDiscardReasonUseCase';
import { DeleteBottleDiscardReasonUseCase } from '@application/usecases/DeleteBottleDiscardReasonUseCase';

// Use cases — bottle openings
import { CreateBottleOpeningUseCase } from '@application/usecases/CreateBottleOpeningUseCase';
import { ListBottleOpeningsUseCase } from '@application/usecases/ListBottleOpeningsUseCase';
import { GetBottleOpeningByIdUseCase } from '@application/usecases/GetBottleOpeningByIdUseCase';
import { CancelBottleOpeningUseCase } from '@application/usecases/CancelBottleOpeningUseCase';

// Use cases — bottle discards
import { CreateBottleDiscardUseCase } from '@application/usecases/CreateBottleDiscardUseCase';
import { ListBottleDiscardsUseCase } from '@application/usecases/ListBottleDiscardsUseCase';
import { GetBottleDiscardByIdUseCase } from '@application/usecases/GetBottleDiscardByIdUseCase';
import { CancelBottleDiscardUseCase } from '@application/usecases/CancelBottleDiscardUseCase';

// Use cases — bulk bottle openings
import { CreateBulkBottleOpeningUseCase } from '@application/usecases/CreateBulkBottleOpeningUseCase';
import { ListBulkBottleOpeningsUseCase } from '@application/usecases/ListBulkBottleOpeningsUseCase';
import { GetBulkBottleOpeningByIdUseCase } from '@application/usecases/GetBulkBottleOpeningByIdUseCase';

// Use cases — bulk bottle discards
import { CreateBulkBottleDiscardUseCase } from '@application/usecases/CreateBulkBottleDiscardUseCase';
import { ListBulkBottleDiscardsUseCase } from '@application/usecases/ListBulkBottleDiscardsUseCase';
import { GetBulkBottleDiscardByIdUseCase } from '@application/usecases/GetBulkBottleDiscardByIdUseCase';

// Use cases — manager locations
import { AssignManagerLocationUseCase } from '@application/usecases/AssignManagerLocationUseCase';
import { ListManagerLocationsUseCase } from '@application/usecases/ListManagerLocationsUseCase';
import { GetManagerLocationByIdUseCase } from '@application/usecases/GetManagerLocationByIdUseCase';
import { RemoveManagerLocationUseCase } from '@application/usecases/RemoveManagerLocationUseCase';

// Use cases — technician rooms
import { AssignTechnicianRoomUseCase } from '@application/usecases/AssignTechnicianRoomUseCase';
import { ListTechnicianRoomsUseCase } from '@application/usecases/ListTechnicianRoomsUseCase';
import { GetTechnicianRoomByIdUseCase } from '@application/usecases/GetTechnicianRoomByIdUseCase';
import { RemoveTechnicianRoomUseCase } from '@application/usecases/RemoveTechnicianRoomUseCase';

// Use cases — system parameters
import { ListSystemParametersUseCase } from '@application/usecases/ListSystemParametersUseCase';
import { GetSystemParameterUseCase } from '@application/usecases/GetSystemParameterUseCase';
import { UpdateSystemParameterUseCase } from '@application/usecases/UpdateSystemParameterUseCase';

// Use cases — notification event configs
import { ListNotificationEventConfigsUseCase } from '@application/usecases/ListNotificationEventConfigsUseCase';
import { UpdateNotificationEventConfigUseCase } from '@application/usecases/UpdateNotificationEventConfigUseCase';

// Use cases — notification location overrides
import { ListNotificationLocationOverridesUseCase } from '@application/usecases/ListNotificationLocationOverridesUseCase';
import { CreateNotificationLocationOverrideUseCase } from '@application/usecases/CreateNotificationLocationOverrideUseCase';
import { UpdateNotificationLocationOverrideUseCase } from '@application/usecases/UpdateNotificationLocationOverrideUseCase';
import { DeleteNotificationLocationOverrideUseCase } from '@application/usecases/DeleteNotificationLocationOverrideUseCase';

// Use cases — notifications
import { ListNotificationsUseCase } from '@application/usecases/ListNotificationsUseCase';
import { MarkNotificationReadUseCase } from '@application/usecases/MarkNotificationReadUseCase';
import { MarkAllNotificationsReadUseCase } from '@application/usecases/MarkAllNotificationsReadUseCase';

// Routes
import { createAuthRouter } from '@interface/routes/authRoutes';
import { createUsersRouter } from '@interface/routes/userRoutes';
import { createLocationsRouter } from '@interface/routes/locationRoutes';
import { createVaccineRoomsRouter } from '@interface/routes/vaccineRoomRoutes';
import { createLaboratoriesRouter } from '@interface/routes/laboratoryRoutes';
import { createVaccinesRouter } from '@interface/routes/vaccineRoutes';
import { createBatchesRouter } from '@interface/routes/batchRoutes';
import { createBatchRoomEntriesRouter } from '@interface/routes/batchRoomEntryRoutes';
import { createBatchTransfersRouter } from '@interface/routes/batchTransferRoutes';
import { createBottleOpeningReasonsRouter } from '@interface/routes/bottleOpeningReasonRoutes';
import { createBottleDiscardReasonsRouter } from '@interface/routes/bottleDiscardReasonRoutes';
import { createBottleOpeningsRouter } from '@interface/routes/bottleOpeningRoutes';
import { createBottleDiscardsRouter } from '@interface/routes/bottleDiscardRoutes';
import { createBulkBottleOpeningsRouter } from '@interface/routes/bulkBottleOpeningRoutes';
import { createBulkBottleDiscardsRouter } from '@interface/routes/bulkBottleDiscardRoutes';
import { createManagerLocationsRouter } from '@interface/routes/managerLocationRoutes';
import { createTechnicianRoomsRouter } from '@interface/routes/technicianRoomRoutes';
import { createSystemParametersRouter } from '@interface/routes/systemParameterRoutes';
import { createNotificationEventConfigsRouter } from '@interface/routes/notificationEventConfigRoutes';
import { createNotificationLocationOverridesRouter } from '@interface/routes/notificationLocationOverrideRoutes';
import { createNotificationsRouter } from '@interface/routes/notificationRoutes';

import { createRateLimitMiddleware } from '@interface/middlewares/rateLimitMiddleware';
import { NotFoundError, ConflictError, UnauthorizedError, TooManyRequestsError, ForbiddenError } from '@domain/errors';
import { fail } from '@interface/helpers/response';

// ─── Infrastructure ───────────────────────────────────────────────────────────
const rateLimiter = new InMemoryRateLimiterService({ maxRequests: 1000, windowMs: 60_000 });
const passwordService = new BcryptPasswordService();
const tokenService = new JwtTokenService();

const userRepo = new PgUserRepository(pool);
const locationRepo = new PgLocationRepository(pool);
const vaccineRoomRepo = new PgVaccineRoomRepository(pool);
const laboratoryRepo = new PgLaboratoryRepository(pool);
const vaccineRepo = new PgVaccineRepository(pool);
const batchRepo = new PgBatchRepository(pool);
const batchRoomEntryRepo = new PgBatchRoomEntryRepository(pool);
const batchTransferRepo = new PgBatchTransferRepository(pool);
const bottleOpeningReasonRepo = new PgBottleOpeningReasonRepository(pool);
const bottleDiscardReasonRepo = new PgBottleDiscardReasonRepository(pool);
const bottleOpeningRepo = new PgBottleOpeningRepository(pool);
const bottleDiscardRepo = new PgBottleDiscardRepository(pool);
const bulkBottleOpeningRepo = new PgBulkBottleOpeningRepository(pool);
const bulkBottleDiscardRepo = new PgBulkBottleDiscardRepository(pool);
const managerLocationRepo = new PgManagerLocationRepository(pool);
const technicianRoomRepo = new PgTechnicianRoomRepository(pool);
const systemParameterRepo = new PgSystemParameterRepository(pool);
const notificationEventConfigRepo = new PgNotificationEventConfigRepository(pool);
const notificationLocationOverrideRepo = new PgNotificationLocationOverrideRepository(pool);
const notificationRepo = new PgNotificationRepository(pool);

const notificationDispatchService = new NotificationDispatchService(notificationRepo);
const permissionService = new PermissionService(managerLocationRepo, technicianRoomRepo, vaccineRoomRepo);

// ─── Use Cases ────────────────────────────────────────────────────────────────
const loginUseCase = new LoginUseCase(userRepo, passwordService, tokenService);
const createUserUseCase = new CreateUserUseCase(userRepo, passwordService);
const listUsersUseCase = new ListUsersUseCase(userRepo);
const getUserByIdUseCase = new GetUserByIdUseCase(userRepo);
const updateUserUseCase = new UpdateUserUseCase(userRepo);
const deleteUserUseCase = new DeleteUserUseCase(userRepo);

const createLocationUseCase = new CreateLocationUseCase(locationRepo);
const listLocationsUseCase = new ListLocationsUseCase(locationRepo);
const getLocationByIdUseCase = new GetLocationByIdUseCase(locationRepo);
const updateLocationUseCase = new UpdateLocationUseCase(locationRepo);
const deleteLocationUseCase = new DeleteLocationUseCase(locationRepo);

const createVaccineRoomUseCase = new CreateVaccineRoomUseCase(vaccineRoomRepo);
const listVaccineRoomsUseCase = new ListVaccineRoomsUseCase(vaccineRoomRepo);
const getVaccineRoomByIdUseCase = new GetVaccineRoomByIdUseCase(vaccineRoomRepo);
const updateVaccineRoomUseCase = new UpdateVaccineRoomUseCase(vaccineRoomRepo);
const deleteVaccineRoomUseCase = new DeleteVaccineRoomUseCase(vaccineRoomRepo);

const createLaboratoryUseCase = new CreateLaboratoryUseCase(laboratoryRepo);
const listLaboratoriesUseCase = new ListLaboratoriesUseCase(laboratoryRepo);
const getLaboratoryByIdUseCase = new GetLaboratoryByIdUseCase(laboratoryRepo);
const updateLaboratoryUseCase = new UpdateLaboratoryUseCase(laboratoryRepo);
const deleteLaboratoryUseCase = new DeleteLaboratoryUseCase(laboratoryRepo);

const createVaccineUseCase = new CreateVaccineUseCase(vaccineRepo, laboratoryRepo);
const listVaccinesUseCase = new ListVaccinesUseCase(vaccineRepo);
const getVaccineByIdUseCase = new GetVaccineByIdUseCase(vaccineRepo);
const updateVaccineUseCase = new UpdateVaccineUseCase(vaccineRepo, laboratoryRepo);
const deleteVaccineUseCase = new DeleteVaccineUseCase(vaccineRepo);

const createBatchUseCase = new CreateBatchUseCase(batchRepo, vaccineRepo);
const listBatchesUseCase = new ListBatchesUseCase(batchRepo);
const getBatchByIdUseCase = new GetBatchByIdUseCase(batchRepo);
const updateBatchUseCase = new UpdateBatchUseCase(batchRepo, vaccineRepo);
const deleteBatchUseCase = new DeleteBatchUseCase(batchRepo);

const createBatchRoomEntryUseCase = new CreateBatchRoomEntryUseCase(batchRoomEntryRepo, batchRepo, permissionService);
const listBatchRoomEntriesUseCase = new ListBatchRoomEntriesUseCase(batchRoomEntryRepo, permissionService);
const getBatchRoomEntryByIdUseCase = new GetBatchRoomEntryByIdUseCase(batchRoomEntryRepo);
const deleteBatchRoomEntryUseCase = new DeleteBatchRoomEntryUseCase(batchRoomEntryRepo, permissionService);

const createBatchTransferUseCase = new CreateBatchTransferUseCase(batchTransferRepo);
const listBatchTransfersUseCase = new ListBatchTransfersUseCase(batchTransferRepo);
const getBatchTransferByIdUseCase = new GetBatchTransferByIdUseCase(batchTransferRepo);
const resolveBatchTransferUseCase = new ResolveBatchTransferUseCase(batchTransferRepo);

const createBottleOpeningReasonUseCase = new CreateBottleOpeningReasonUseCase(bottleOpeningReasonRepo);
const listBottleOpeningReasonsUseCase = new ListBottleOpeningReasonsUseCase(bottleOpeningReasonRepo);
const getBottleOpeningReasonByIdUseCase = new GetBottleOpeningReasonByIdUseCase(bottleOpeningReasonRepo);
const updateBottleOpeningReasonUseCase = new UpdateBottleOpeningReasonUseCase(bottleOpeningReasonRepo);
const deleteBottleOpeningReasonUseCase = new DeleteBottleOpeningReasonUseCase(bottleOpeningReasonRepo);

const createBottleDiscardReasonUseCase = new CreateBottleDiscardReasonUseCase(bottleDiscardReasonRepo);
const listBottleDiscardReasonsUseCase = new ListBottleDiscardReasonsUseCase(bottleDiscardReasonRepo);
const getBottleDiscardReasonByIdUseCase = new GetBottleDiscardReasonByIdUseCase(bottleDiscardReasonRepo);
const updateBottleDiscardReasonUseCase = new UpdateBottleDiscardReasonUseCase(bottleDiscardReasonRepo);
const deleteBottleDiscardReasonUseCase = new DeleteBottleDiscardReasonUseCase(bottleDiscardReasonRepo);

const createBottleOpeningUseCase = new CreateBottleOpeningUseCase(bottleOpeningRepo, notificationDispatchService);
const listBottleOpeningsUseCase = new ListBottleOpeningsUseCase(bottleOpeningRepo);
const getBottleOpeningByIdUseCase = new GetBottleOpeningByIdUseCase(bottleOpeningRepo);
const cancelBottleOpeningUseCase = new CancelBottleOpeningUseCase(bottleOpeningRepo);

const createBottleDiscardUseCase = new CreateBottleDiscardUseCase(bottleDiscardRepo, notificationDispatchService);
const listBottleDiscardsUseCase = new ListBottleDiscardsUseCase(bottleDiscardRepo);
const getBottleDiscardByIdUseCase = new GetBottleDiscardByIdUseCase(bottleDiscardRepo);
const cancelBottleDiscardUseCase = new CancelBottleDiscardUseCase(bottleDiscardRepo);

const createBulkBottleOpeningUseCase = new CreateBulkBottleOpeningUseCase(bulkBottleOpeningRepo, notificationDispatchService);
const listBulkBottleOpeningsUseCase = new ListBulkBottleOpeningsUseCase(bulkBottleOpeningRepo);
const getBulkBottleOpeningByIdUseCase = new GetBulkBottleOpeningByIdUseCase(bulkBottleOpeningRepo);

const createBulkBottleDiscardUseCase = new CreateBulkBottleDiscardUseCase(bulkBottleDiscardRepo);
const listBulkBottleDiscardsUseCase = new ListBulkBottleDiscardsUseCase(bulkBottleDiscardRepo);
const getBulkBottleDiscardByIdUseCase = new GetBulkBottleDiscardByIdUseCase(bulkBottleDiscardRepo);

const assignManagerLocationUseCase = new AssignManagerLocationUseCase(managerLocationRepo);
const listManagerLocationsUseCase = new ListManagerLocationsUseCase(managerLocationRepo);
const getManagerLocationByIdUseCase = new GetManagerLocationByIdUseCase(managerLocationRepo);
const removeManagerLocationUseCase = new RemoveManagerLocationUseCase(managerLocationRepo);

const assignTechnicianRoomUseCase = new AssignTechnicianRoomUseCase(technicianRoomRepo);
const listTechnicianRoomsUseCase = new ListTechnicianRoomsUseCase(technicianRoomRepo);
const getTechnicianRoomByIdUseCase = new GetTechnicianRoomByIdUseCase(technicianRoomRepo);
const removeTechnicianRoomUseCase = new RemoveTechnicianRoomUseCase(technicianRoomRepo);

const listSystemParametersUseCase = new ListSystemParametersUseCase(systemParameterRepo);
const getSystemParameterUseCase = new GetSystemParameterUseCase(systemParameterRepo);
const updateSystemParameterUseCase = new UpdateSystemParameterUseCase(systemParameterRepo);

const listNotificationEventConfigsUseCase = new ListNotificationEventConfigsUseCase(notificationEventConfigRepo);
const updateNotificationEventConfigUseCase = new UpdateNotificationEventConfigUseCase(notificationEventConfigRepo);

const listNotificationLocationOverridesUseCase = new ListNotificationLocationOverridesUseCase(notificationLocationOverrideRepo);
const createNotificationLocationOverrideUseCase = new CreateNotificationLocationOverrideUseCase(notificationLocationOverrideRepo);
const updateNotificationLocationOverrideUseCase = new UpdateNotificationLocationOverrideUseCase(notificationLocationOverrideRepo);
const deleteNotificationLocationOverrideUseCase = new DeleteNotificationLocationOverrideUseCase(notificationLocationOverrideRepo);

const listNotificationsUseCase = new ListNotificationsUseCase(notificationRepo);
const markNotificationReadUseCase = new MarkNotificationReadUseCase(notificationRepo);
const markAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase(notificationRepo);

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(createRateLimitMiddleware(rateLimiter));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', createAuthRouter(loginUseCase));

app.use(
  '/users',
  createUsersRouter(
    tokenService,
    createUserUseCase,
    listUsersUseCase,
    getUserByIdUseCase,
    updateUserUseCase,
    deleteUserUseCase,
  ),
);

app.use(
  '/locations',
  createLocationsRouter(
    tokenService,
    createLocationUseCase,
    listLocationsUseCase,
    getLocationByIdUseCase,
    updateLocationUseCase,
    deleteLocationUseCase,
  ),
);

app.use(
  '/vaccine-rooms',
  createVaccineRoomsRouter(
    tokenService,
    createVaccineRoomUseCase,
    listVaccineRoomsUseCase,
    getVaccineRoomByIdUseCase,
    updateVaccineRoomUseCase,
    deleteVaccineRoomUseCase,
  ),
);

app.use(
  '/laboratories',
  createLaboratoriesRouter(
    tokenService,
    createLaboratoryUseCase,
    listLaboratoriesUseCase,
    getLaboratoryByIdUseCase,
    updateLaboratoryUseCase,
    deleteLaboratoryUseCase,
  ),
);

app.use(
  '/vaccines',
  createVaccinesRouter(
    tokenService,
    createVaccineUseCase,
    listVaccinesUseCase,
    getVaccineByIdUseCase,
    updateVaccineUseCase,
    deleteVaccineUseCase,
  ),
);

app.use(
  '/batches',
  createBatchesRouter(
    tokenService,
    createBatchUseCase,
    listBatchesUseCase,
    getBatchByIdUseCase,
    updateBatchUseCase,
    deleteBatchUseCase,
  ),
);

app.use(
  '/batch-room-entries',
  createBatchRoomEntriesRouter(
    tokenService,
    createBatchRoomEntryUseCase,
    listBatchRoomEntriesUseCase,
    getBatchRoomEntryByIdUseCase,
    deleteBatchRoomEntryUseCase,
  ),
);

app.use(
  '/batch-transfers',
  createBatchTransfersRouter(
    tokenService,
    createBatchTransferUseCase,
    listBatchTransfersUseCase,
    getBatchTransferByIdUseCase,
    resolveBatchTransferUseCase,
  ),
);

app.use(
  '/bottle-opening-reasons',
  createBottleOpeningReasonsRouter(
    tokenService,
    createBottleOpeningReasonUseCase,
    listBottleOpeningReasonsUseCase,
    getBottleOpeningReasonByIdUseCase,
    updateBottleOpeningReasonUseCase,
    deleteBottleOpeningReasonUseCase,
  ),
);

app.use(
  '/bottle-discard-reasons',
  createBottleDiscardReasonsRouter(
    tokenService,
    createBottleDiscardReasonUseCase,
    listBottleDiscardReasonsUseCase,
    getBottleDiscardReasonByIdUseCase,
    updateBottleDiscardReasonUseCase,
    deleteBottleDiscardReasonUseCase,
  ),
);

app.use(
  '/bottle-openings',
  createBottleOpeningsRouter(
    tokenService,
    createBottleOpeningUseCase,
    listBottleOpeningsUseCase,
    getBottleOpeningByIdUseCase,
    cancelBottleOpeningUseCase,
  ),
);

app.use(
  '/bottle-discards',
  createBottleDiscardsRouter(
    tokenService,
    createBottleDiscardUseCase,
    listBottleDiscardsUseCase,
    getBottleDiscardByIdUseCase,
    cancelBottleDiscardUseCase,
  ),
);

app.use(
  '/bulk-bottle-openings',
  createBulkBottleOpeningsRouter(
    tokenService,
    createBulkBottleOpeningUseCase,
    listBulkBottleOpeningsUseCase,
    getBulkBottleOpeningByIdUseCase,
  ),
);

app.use(
  '/bulk-bottle-discards',
  createBulkBottleDiscardsRouter(
    tokenService,
    createBulkBottleDiscardUseCase,
    listBulkBottleDiscardsUseCase,
    getBulkBottleDiscardByIdUseCase,
  ),
);

app.use(
  '/manager-locations',
  createManagerLocationsRouter(
    tokenService,
    assignManagerLocationUseCase,
    listManagerLocationsUseCase,
    getManagerLocationByIdUseCase,
    removeManagerLocationUseCase,
  ),
);

app.use(
  '/technician-rooms',
  createTechnicianRoomsRouter(
    tokenService,
    assignTechnicianRoomUseCase,
    listTechnicianRoomsUseCase,
    getTechnicianRoomByIdUseCase,
    removeTechnicianRoomUseCase,
  ),
);

app.use(
  '/system-parameters',
  createSystemParametersRouter(
    tokenService,
    listSystemParametersUseCase,
    getSystemParameterUseCase,
    updateSystemParameterUseCase,
  ),
);

app.use(
  '/notification-event-configs',
  createNotificationEventConfigsRouter(
    tokenService,
    listNotificationEventConfigsUseCase,
    updateNotificationEventConfigUseCase,
  ),
);

app.use(
  '/notification-location-overrides',
  createNotificationLocationOverridesRouter(
    tokenService,
    listNotificationLocationOverridesUseCase,
    createNotificationLocationOverrideUseCase,
    updateNotificationLocationOverrideUseCase,
    deleteNotificationLocationOverrideUseCase,
  ),
);

app.use(
  '/notifications',
  createNotificationsRouter(
    tokenService,
    listNotificationsUseCase,
    markNotificationReadUseCase,
    markAllNotificationsReadUseCase,
  ),
);

app.get('/docs.json', (_req, res) => res.json(swaggerSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof NotFoundError) {
    fail(res, err.message, 404);
    return;
  }
  if (err instanceof UnauthorizedError) {
    fail(res, err.message, 401);
    return;
  }
  if (err instanceof ConflictError) {
    fail(res, err.message, 409);
    return;
  }
  if (err instanceof ForbiddenError) {
    fail(res, err.message, 403);
    return;
  }
  if (err instanceof TooManyRequestsError) {
    fail(res, err.message, 429);
    return;
  }
  if (err instanceof ZodError) {
    fail(res, 'Validation error', 422, err.format());
    return;
  }
  console.error(err);
  fail(res, 'Internal server error', 500);
});

const PORT = Number(env.PORT);
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
