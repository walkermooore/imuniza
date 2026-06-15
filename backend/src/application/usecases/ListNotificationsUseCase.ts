import { Notification } from '@domain/entities/Notification';
import { INotificationRepository } from '@domain/repositories/INotificationRepository';
import { PaginatedResult } from '@domain/shared/Pagination';

export interface ListNotificationsInput {
  user_id: string;
  page: number;
  page_size: number;
  search?: string;
}

export class ListNotificationsUseCase {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(input: ListNotificationsInput): Promise<PaginatedResult<Notification & { description: string }>> {
    return this.repo.findByUserId(input.user_id, {
      page: input.page,
      page_size: input.page_size,
      search: input.search,
    });
  }
}
