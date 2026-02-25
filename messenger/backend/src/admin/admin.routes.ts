/**
 * Admin routes: user management, moderation queue
 */
import { Router, Request, Response, NextFunction } from 'express';
import { param, body, query } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { AdminService } from './admin.service';

export const adminRouter = Router();
const adminService = new AdminService();

adminRouter.use(authenticate, requireAdmin);

// List all users
adminRouter.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await adminService.listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Ban/unban user
adminRouter.patch(
  '/users/:id/ban',
  [param('id').isUUID(), body('banned').isBoolean(), validate],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await adminService.setBanned(req.params.id, req.body.banned);
      res.json({ message: 'Updated' });
    } catch (error) {
      next(error);
    }
  }
);

// Moderation queue
adminRouter.get('/moderation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = (req.query.status as string) || 'pending';
    const queue = await adminService.getModerationQueue(status);
    res.json(queue);
  } catch (error) {
    next(error);
  }
});

// Resolve moderation item
adminRouter.patch(
  '/moderation/:id',
  [
    param('id').isUUID(),
    body('action').isIn(['approve', 'reject', 'delete']),
    validate,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminUser = req.user as { id: string };
      await adminService.resolveModeration(req.params.id, req.body.action, adminUser.id);
      res.json({ message: 'Resolved' });
    } catch (error) {
      next(error);
    }
  }
);

// Stats overview
adminRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});
