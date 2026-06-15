import { INotificationRepository } from '@domain/repositories/INotificationRepository';

export interface MarkAllNotificationsReadInput {
  user_id: string;
}

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(input: MarkAllNotificationsReadInput): Promise<void> {
    return this.repo.markAllRead(input.user_id);
  }
}
