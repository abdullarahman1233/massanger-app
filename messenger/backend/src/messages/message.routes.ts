/**
 * Message routes: CRUD for messages in rooms
 */
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { MessageController } from './message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const messageRouter = Router();
const controller = new MessageController();

messageRouter.use(authenticate);

// Get messages in a room
messageRouter.get(
  '/room/:roomId',
  [
    param('roomId').isUUID(),
    query('before').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  controller.getMessages.bind(controller)
);

// Send a message
messageRouter.post(
  '/room/:roomId',
  [
    param('roomId').isUUID(),
    body('content').optional().trim().isLength({ max: 4000 }),
    body('attachmentUrl').optional().isURL(),
    body('attachmentType').optional().isIn(['image', 'file']),
    body('ttl').optional().isInt({ min: 0 }),
    body('replyToId').optional().isUUID(),
    validate,
  ],
  controller.sendMessage.bind(controller)
);

// Mark messages as read
messageRouter.post(
  '/room/:roomId/read',
  [param('roomId').isUUID(), validate],
  controller.markRead.bind(controller)
);

// Delete a message
messageRouter.delete(
  '/:id',
  [param('id').isUUID(), validate],
  controller.deleteMessage.bind(controller)
);
