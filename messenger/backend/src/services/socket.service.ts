/**
 * Socket.IO service
 * Handles real-time events: messages, typing, presence, delivery receipts
 */
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
}

let io: Server;

export function getIO(): Server {
  return io;
}

export function initializeSocketIO(server: HttpServer): void {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      ) as { sub: string; email: string };

      (socket as AuthenticatedSocket).userId = payload.sub;
      (socket as AuthenticatedSocket).userEmail = payload.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;
    logger.info(`User connected: ${userId}`);

    // Mark user online in Redis
    await setPresence(userId, 'online', socket.id);
    
    // Join all user's rooms
    const rooms = await getUserRoomIds(userId);
    for (const roomId of rooms) {
      socket.join(roomId);
    }

    // Broadcast online status to room members
    broadcastPresence(userId, 'online', rooms);

    // ── Event handlers ──

    // Join a specific room
    socket.on('join_room', async (roomId: string) => {
      const isMember = await checkRoomMembership(userId, roomId);
      if (isMember) {
        socket.join(roomId);
        socket.to(roomId).emit('user_joined', { userId, roomId });
      }
    });

    // Typing indicator
    socket.on('typing_start', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('typing_start', { userId, roomId });
    });

    socket.on('typing_stop', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('typing_stop', { userId, roomId });
    });

    // Message delivered confirmation
    socket.on('message_delivered', async ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      await query(
        `UPDATE messages SET status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END WHERE id = $1`,
        [messageId]
      );
      io.to(roomId).emit('message_status_updated', { messageId, status: 'delivered' });
    });

    // Message read
    socket.on('messages_read', async ({ roomId }: { roomId: string }) => {
      await query(
        `UPDATE messages SET status = 'read'
         WHERE room_id = $1 AND sender_id != $2 AND status != 'read'`,
        [roomId, userId]
      );
      // Update room_members last_read_at
      await query(
        `UPDATE room_members SET last_read_at = NOW() WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
      );
      socket.to(roomId).emit('messages_read', { roomId, userId });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${userId}`);
      await setPresence(userId, 'offline', socket.id);
      await query('UPDATE users SET last_seen = NOW(), status = $1 WHERE id = $2', ['offline', userId]);
      broadcastPresence(userId, 'offline', rooms);
    });
  });
}

/**
 * Emit a new message to all room members via Socket.IO
 * Called by message service after persisting to DB
 */
export function emitNewMessage(roomId: string, message: object): void {
  if (io) {
    io.to(roomId).emit('new_message', message);
  }
}

async function setPresence(userId: string, status: string, socketId: string): Promise<void> {
  const redis = getRedis();
  if (status === 'online') {
    await redis.sadd(`presence:${userId}`, socketId);
    await redis.set(`user:status:${userId}`, 'online');
  } else {
    await redis.srem(`presence:${userId}`, socketId);
    const remaining = await redis.scard(`presence:${userId}`);
    if (remaining === 0) {
      await redis.set(`user:status:${userId}`, 'offline');
    }
  }
}

async function getUserRoomIds(userId: string): Promise<string[]> {
  const result = await query<{ room_id: string }>(
    'SELECT room_id FROM room_members WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  return result.rows.map(r => r.room_id);
}

async function checkRoomMembership(userId: string, roomId: string): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM room_members WHERE user_id = $1 AND room_id = $2 AND is_active = true',
    [userId, roomId]
  );
  return result.rows.length > 0;
}

function broadcastPresence(userId: string, status: string, roomIds: string[]): void {
  if (!io) return;
  for (const roomId of roomIds) {
    io.to(roomId).emit('presence_update', { userId, status });
  }
}
