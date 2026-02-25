/**
 * Room service: create/manage chat rooms (direct and group)
 */
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { AppError } from '../utils/errors';
import { PoolClient } from 'pg';

export class RoomService {
  async listUserRooms(userId: string) {
    const result = await query<{
      id: string;
      type: string;
      name: string | null;
      avatar_url: string | null;
      created_at: Date;
      last_message_at: Date | null;
      last_message_content: string | null;
      unread_count: string;
    }>(
      `SELECT r.id, r.type, r.name, r.avatar_url, r.created_at,
              r.last_message_at,
              (SELECT content FROM messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
              (SELECT COUNT(*) FROM messages m
               WHERE m.room_id = r.id
                 AND m.created_at > COALESCE(
                   (SELECT last_read_at FROM room_members rm2 WHERE rm2.room_id = r.id AND rm2.user_id = $1),
                   '1970-01-01'::timestamptz
                 )
                 AND m.sender_id != $1
              ) as unread_count
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       WHERE rm.user_id = $1 AND rm.is_active = true
       ORDER BY COALESCE(r.last_message_at, r.created_at) DESC`,
      [userId]
    );

    // For direct rooms, get the other user's info
    const rooms = await Promise.all(
      result.rows.map(async (room) => {
        if (room.type === 'direct') {
          const otherUser = await query<{ id: string; display_name: string; avatar_url: string | null; status: string }>(
            `SELECT u.id, u.display_name, u.avatar_url, u.status
             FROM users u
             JOIN room_members rm ON rm.user_id = u.id
             WHERE rm.room_id = $1 AND u.id != $2
             LIMIT 1`,
            [room.id, userId]
          );
          if (otherUser.rows[0]) {
            return {
              ...room,
              name: otherUser.rows[0].display_name,
              avatarUrl: otherUser.rows[0].avatar_url,
              otherUser: otherUser.rows[0],
              unreadCount: parseInt(room.unread_count),
            };
          }
        }
        return { ...room, unreadCount: parseInt(room.unread_count) };
      })
    );

    return rooms;
  }

  async createRoom(
    creatorId: string,
    type: 'direct' | 'group',
    memberIds: string[],
    name?: string
  ) {
    // For direct messages, check if room already exists
    if (type === 'direct') {
      const otherId = memberIds.find(id => id !== creatorId) || memberIds[0];
      const allIds = [creatorId, otherId].sort();
      
      const existing = await query<{ id: string }>(
        `SELECT r.id FROM rooms r
         JOIN room_members rm1 ON rm1.room_id = r.id AND rm1.user_id = $1
         JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id = $2
         WHERE r.type = 'direct'
         LIMIT 1`,
        [allIds[0], allIds[1]]
      );

      if (existing.rows[0]) {
        return this.getRoomById(existing.rows[0].id);
      }
    }

    return withTransaction(async (client: PoolClient) => {
      const roomId = uuidv4();
      await client.query(
        `INSERT INTO rooms (id, type, name, created_by) VALUES ($1, $2, $3, $4)`,
        [roomId, type, name || null, creatorId]
      );

      // Add all members (include creator if not in list)
      const allMembers = Array.from(new Set([creatorId, ...memberIds]));
      for (const memberId of allMembers) {
        await client.query(
          `INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)`,
          [roomId, memberId, memberId === creatorId ? 'admin' : 'member']
        );
      }

      return this.getRoomById(roomId);
    });
  }

  async getRoomById(roomId: string) {
    const result = await query<{
      id: string;
      type: string;
      name: string | null;
      avatar_url: string | null;
      created_at: Date;
    }>(
      'SELECT id, type, name, avatar_url, created_at FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!result.rows[0]) throw new AppError('Room not found', 404);

    const members = await query<{ id: string; display_name: string; avatar_url: string | null; status: string; role: string }>(
      `SELECT u.id, u.display_name, u.avatar_url, u.status, rm.role
       FROM users u
       JOIN room_members rm ON rm.user_id = u.id
       WHERE rm.room_id = $1 AND rm.is_active = true`,
      [roomId]
    );

    return { ...result.rows[0], members: members.rows };
  }

  async getRoomForUser(roomId: string, userId: string) {
    const member = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND is_active = true',
      [roomId, userId]
    );
    if (!member.rows[0]) throw new AppError('Room not found or access denied', 404);
    return this.getRoomById(roomId);
  }

  async addMember(roomId: string, userId: string, requesterId: string) {
    // Check requester is admin
    const req = await query(
      `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, requesterId]
    );
    if (!req.rows[0] || req.rows[0].role !== 'admin') {
      throw new AppError('Only admins can add members', 403);
    }
    await query(
      `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [roomId, userId]
    );
  }

  async removeMember(roomId: string, userId: string, requesterId: string) {
    const req = await query(
      `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, requesterId]
    );
    if (!req.rows[0] || (req.rows[0].role !== 'admin' && requesterId !== userId)) {
      throw new AppError('Permission denied', 403);
    }
    await query(
      `UPDATE room_members SET is_active = false WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
  }
}
