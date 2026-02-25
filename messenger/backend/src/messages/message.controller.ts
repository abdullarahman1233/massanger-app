import { Request, Response, NextFunction } from 'express';
import { MessageService } from './message.service';

const messageService = new MessageService();

export class MessageController {
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      const { roomId } = req.params;
      const before = req.query.before as string | undefined;
      const limit = parseInt(req.query.limit as string || '50');
      const messages = await messageService.getMessages(roomId, user.id, before, limit);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      const { roomId } = req.params;
      const message = await messageService.sendMessage(user.id, roomId, req.body);
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      await messageService.markRead(req.params.roomId, user.id);
      res.json({ message: 'Marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id: string };
      await messageService.deleteMessage(req.params.id, user.id);
      res.json({ message: 'Deleted' });
    } catch (error) {
      next(error);
    }
  }
}
