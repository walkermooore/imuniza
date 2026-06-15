import { Notification } from '@domain/entities/Notification';
import { INotificationRepository } from '@domain/repositories/INotificationRepository';
import { NotFoundError } from '@domain/errors';

export interface MarkNotificationReadInput {
  id: string;
  user_id: string;
}

export class MarkNotificationReadUseCase {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(input: MarkNotificationReadInput): Promise<Notification> {
    const result = await this.repo.markRead(input.id, input.user_id);
    if (!result) throw new NotFoundError('Notification not found');
    return result;
  }
}
