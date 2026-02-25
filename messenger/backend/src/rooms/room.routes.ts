/**
 * Room (conversation) management routes
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import { RoomController } from './room.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const roomRouter = Router();
const controller = new RoomController();

roomRouter.use(authenticate);

// List user's rooms
roomRouter.get('/', controller.listRooms.bind(controller));

// Create a room (group or direct)
roomRouter.post(
  '/',
  [
    body('type').isIn(['direct', 'group']),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('memberIds').isArray({ min: 1 }),
    body('memberIds.*').isUUID(),
    validate,
  ],
  controller.createRoom.bind(controller)
);

// Get room details
roomRouter.get(
  '/:id',
  [param('id').isUUID(), validate],
  controller.getRoom.bind(controller)
);

// Add member to group
roomRouter.post(
  '/:id/members',
  [param('id').isUUID(), body('userId').isUUID(), validate],
  controller.addMember.bind(controller)
);

// Remove member from group
roomRouter.delete(
  '/:id/members/:userId',
  [param('id').isUUID(), param('userId').isUUID(), validate],
  controller.removeMember.bind(controller)
);
