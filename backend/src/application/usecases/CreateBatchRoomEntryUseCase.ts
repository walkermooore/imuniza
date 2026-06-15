import { BatchRoomEntry } from '@domain/entities/BatchRoomEntry';
import { IBatchRoomEntryRepository } from '@domain/repositories/IBatchRoomEntryRepository';
import { IBatchRepository } from '@domain/repositories/IBatchRepository';
import { ConflictError, ForbiddenError } from '@domain/errors';
import { PermissionService } from '@domain/services/PermissionService';

export type CreateBatchRoomEntryDTO = {
  batch_id: string;
  vaccine_room_id: string;
  bottle_count: number;
  source_batch_entry_id?: string;
  created_by: string;
  user: {
    id: string;
    role: string;
  };
};

export class CreateBatchRoomEntryUseCase {
  constructor(
    private readonly batchRoomEntryRepo: IBatchRoomEntryRepository,
    private readonly batchRepo: IBatchRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(dto: CreateBatchRoomEntryDTO): Promise<BatchRoomEntry> {
    const canAccess = await this.permissionService.canAccessRoom(
      dto.user.id,
      dto.user.role,
      dto.vaccine_room_id,
    );

    if (!canAccess) {
      throw new ForbiddenError('You do not have permission to create entries for this room');
    }

    const batch = await this.batchRepo.findById(dto.batch_id);
    if (!batch || batch.is_deleted) throw new ConflictError('Batch not found');

    return this.batchRoomEntryRepo.create({
      batch_id: dto.batch_id,
      vaccine_room_id: dto.vaccine_room_id,
      bottle_count: dto.bottle_count,
      source_batch_entry_id: dto.source_batch_entry_id,
      created_by: dto.created_by,
    });
  }
}
