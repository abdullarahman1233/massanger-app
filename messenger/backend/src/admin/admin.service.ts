import { query } from '../config/database';

export class AdminService {
  async listUsers() {
    const result = await query<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      is_banned: boolean;
      is_active: boolean;
      created_at: Date;
      last_seen: Date;
    }>(
      `SELECT id, email, display_name, role, is_banned, is_active, created_at, last_seen
       FROM users ORDER BY created_at DESC LIMIT 200`
    );
    return result.rows;
  }

  async setBanned(userId: string, banned: boolean): Promise<void> {
    await query('UPDATE users SET is_banned = $1 WHERE id = $2', [banned, userId]);
  }

  async getModerationQueue(status: string) {
    const result = await query<{
      id: string;
      message_id: string;
      reason: string;
      status: string;
      created_at: Date;
      content: string;
      sender_email: string;
    }>(
      `SELECT mq.id, mq.message_id, mq.reason, mq.status, mq.created_at,
              m.content, u.email as sender_email
       FROM moderation_queue mq
       JOIN messages m ON m.id = mq.message_id
       JOIN users u ON u.id = m.sender_id
       WHERE mq.status = $1
       ORDER BY mq.created_at DESC`,
      [status]
    );
    return result.rows;
  }

  async resolveModeration(queueId: string, action: string, adminId: string): Promise<void> {
    await query(
      `UPDATE moderation_queue SET status = $1, resolved_by = $2, resolved_at = NOW()
       WHERE id = $3`,
      [action === 'approve' ? 'approved' : 'rejected', adminId, queueId]
    );

    if (action === 'delete') {
      const item = await query<{ message_id: string }>(
        'SELECT message_id FROM moderation_queue WHERE id = $1',
        [queueId]
      );
      if (item.rows[0]) {
        await query('UPDATE messages SET is_deleted = true WHERE id = $1', [item.rows[0].message_id]);
      }
    }
  }

  async getStats() {
    const [users, messages, rooms, pending] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM messages WHERE is_deleted = false'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM rooms'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM moderation_queue WHERE status = \'pending\''),
    ]);

    return {
      totalUsers: parseInt(users.rows[0]?.count || '0'),
      totalMessages: parseInt(messages.rows[0]?.count || '0'),
      totalRooms: parseInt(rooms.rows[0]?.count || '0'),
      pendingModeration: parseInt(pending.rows[0]?.count || '0'),
    };
  }
}
