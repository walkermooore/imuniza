import { UserRole } from '@domain/entities/User';
import { IManagerLocationRepository } from '@domain/repositories/IManagerLocationRepository';
import { ITechnicianRoomRepository } from '@domain/repositories/ITechnicianRoomRepository';
import { IVaccineRoomRepository } from '@domain/repositories/IVaccineRoomRepository';

export class PermissionService {
  constructor(
    private readonly managerLocationRepo: IManagerLocationRepository,
    private readonly technicianRoomRepo: ITechnicianRoomRepository,
    private readonly vaccineRoomRepo: IVaccineRoomRepository,
  ) {}

  async canAccessRoom(userId: string, userRole: string, vaccineRoomId: string): Promise<boolean> {
    if (userRole === UserRole.administrador) {
      return true;
    }

    if (userRole === UserRole.gestor) {
      const room = await this.vaccineRoomRepo.findById(vaccineRoomId);
      if (!room) return false;
      const active = await this.managerLocationRepo.findActive(userId, room.location_id);
      return !!active;
    }

    if (userRole === UserRole.tecnico) {
      const active = await this.technicianRoomRepo.findActive(userId, vaccineRoomId);
      return !!active;
    }

    return false;
  }

  async getAllowedRoomIds(userId: string, userRole: string): Promise<string[] | null> {
    if (userRole === UserRole.administrador) {
      return null; // No restriction
    }

    if (userRole === UserRole.gestor) {
      const locations = await this.managerLocationRepo.list({ user_id: userId, page: 1, page_size: 1000 });
      const locationIds = locations.data.map(l => l.location_id);
      if (locationIds.length === 0) return [];
      
      // This is a bit inefficient but works for now. 
      // Ideally we'd have a method in vaccineRoomRepo to list by multiple location IDs.
      const rooms = await this.vaccineRoomRepo.list({ page: 1, page_size: 1000 });
      return rooms.data
        .filter(r => locationIds.includes(r.location_id))
        .map(r => r.id);
    }

    if (userRole === UserRole.tecnico) {
      const assignments = await this.technicianRoomRepo.list({ user_id: userId, page: 1, page_size: 1000 });
      return assignments.data.map(a => a.vaccine_room_id);
    }

    return [];
  }
}
