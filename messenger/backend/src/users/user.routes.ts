/**
 * User management routes: profile, presence, search
 */
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { UserController } from './user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const userRouter = Router();
const controller = new UserController();

// All user routes require authentication
userRouter.use(authenticate);

// Get current user profile
userRouter.get('/me', controller.getMe.bind(controller));

// Update profile
userRouter.patch(
  '/me',
  [
    body('displayName').optional().trim().isLength({ min: 1, max: 50 }),
    body('status').optional().isIn(['online', 'away', 'busy', 'offline']),
    body('bio').optional().trim().isLength({ max: 200 }),
    validate,
  ],
  controller.updateProfile.bind(controller)
);

// Search users
userRouter.get(
  '/search',
  [query('q').isString().trim().isLength({ min: 1 }), validate],
  controller.searchUsers.bind(controller)
);

// Get user by ID
userRouter.get(
  '/:id',
  [param('id').isUUID(), validate],
  controller.getUserById.bind(controller)
);
