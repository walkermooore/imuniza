import { IBatchRoomEntryRepository } from '@domain/repositories/IBatchRoomEntryRepository';
import { NotFoundError, ForbiddenError } from '@domain/errors';
import { PermissionService } from '@domain/services/PermissionService';

export type DeleteBatchRoomEntryDTO = {
  id: string;
  user: {
    id: string;
    role: string;
  };
};

export class DeleteBatchRoomEntryUseCase {
  constructor(
    private readonly batchRoomEntryRepo: IBatchRoomEntryRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(dto: DeleteBatchRoomEntryDTO): Promise<void> {
    const existing = await this.batchRoomEntryRepo.findById(dto.id);
    if (!existing || existing.is_deleted) throw new NotFoundError('Batch room entry not found');

    const canAccess = await this.permissionService.canAccessRoom(
      dto.user.id,
      dto.user.role,
      existing.vaccine_room_id,
    );

    if (!canAccess) {
      throw new ForbiddenError('You do not have permission to delete entries for this room');
    }

    await this.batchRoomEntryRepo.softDelete(dto.id);
  }
}
