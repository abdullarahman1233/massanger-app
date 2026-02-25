import { Request, Response, NextFunction } from 'express';
import { RoomService } from './room.service';

const roomService = new RoomService();

export class RoomController {
  async listRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      const rooms = await roomService.listUserRooms(user.id);
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  }

  async createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      const { type, name, memberIds } = req.body;
      const room = await roomService.createRoom(user.id, type, memberIds, name);
      res.status(201).json(room);
    } catch (error) {
      next(error);
    }
  }

  async getRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      const room = await roomService.getRoomForUser(req.params.id, user.id);
      res.json(room);
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      await roomService.addMember(req.params.id, req.body.userId, user.id);
      res.json({ message: 'Member added' });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      await roomService.removeMember(req.params.id, req.params.userId, user.id);
      res.json({ message: 'Member removed' });
    } catch (error) {
      next(error);
    }
  }
}
