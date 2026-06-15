import { BatchRoomEntry } from '@domain/entities/BatchRoomEntry';
import {
  IBatchRoomEntryRepository,
  ListBatchRoomEntriesInput,
} from '@domain/repositories/IBatchRoomEntryRepository';
import { PaginatedResult } from '@domain/shared/Pagination';
import { PermissionService } from '@domain/services/PermissionService';

export type ListBatchRoomEntriesDTO = ListBatchRoomEntriesInput & {
  user: {
    id: string;
    role: string;
  };
};

export class ListBatchRoomEntriesUseCase {
  constructor(
    private readonly batchRoomEntryRepo: IBatchRoomEntryRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(params: ListBatchRoomEntriesDTO): Promise<PaginatedResult<BatchRoomEntry>> {
    const allowedRoomIds = await this.permissionService.getAllowedRoomIds(
      params.user.id,
      params.user.role,
    );

    if (allowedRoomIds !== null) {
      if (allowedRoomIds.length === 0) {
        return { data: [], meta: { page: params.page, page_size: params.page_size, total: 0 } };
      }

      if (params.vaccine_room_id) {
        if (!allowedRoomIds.includes(params.vaccine_room_id)) {
          return { data: [], meta: { page: params.page, page_size: params.page_size, total: 0 } };
        }
      } else {
        params.vaccine_room_ids = allowedRoomIds;
      }
    }

    return this.batchRoomEntryRepo.list(params);
  }
}
