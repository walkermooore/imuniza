import { INotificationLocationOverrideRepository } from '@domain/repositories/INotificationLocationOverrideRepository';

export class DeleteNotificationLocationOverrideUseCase {
  constructor(private readonly repo: INotificationLocationOverrideRepository) {}

  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
