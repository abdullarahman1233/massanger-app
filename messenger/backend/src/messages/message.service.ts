/**
 * Message service: send, retrieve, delete messages with moderation/translation stubs
 */
import { v4 as uuidv4 } from 'uuid';
import xss from 'xss';
import { query } from '../config/database';
import { AppError } from '../utils/errors';
import { ModerationService } from '../services/moderation.service';
import { TranslationService } from '../services/translation.service';
import { logger } from '../utils/logger';

const moderationService = new ModerationService();
const translationService = new TranslationService();

interface SendMessageData {
  content?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file';
  ttl?: number;
  replyToId?: string;
}

export class MessageService {
  async getMessages(roomId: string, userId: string, before?: string, limit = 50) {
    // Verify user is in room
    const member = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND is_active = true',
      [roomId, userId]
    );
    if (!member.rows[0]) throw new AppError('Access denied', 403);

    const result = await query<{
      id: string;
      sender_id: string;
      room_id: string;
      content: string | null;
      attachment_url: string | null;
      attachment_type: string | null;
      status: string;
      reply_to_id: string | null;
      expires_at: Date | null;
      created_at: Date;
      sender_name: string;
      sender_avatar: string | null;
    }>(
      `SELECT m.id, m.sender_id, m.room_id, m.content, m.attachment_url, m.attachment_type,
              m.status, m.reply_to_id, m.expires_at, m.created_at,
              u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = $1
         AND m.is_deleted = false
         AND (m.expires_at IS NULL OR m.expires_at > NOW())
         ${before ? 'AND m.created_at < $3' : ''}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      before ? [roomId, limit, before] : [roomId, limit]
    );

    return result.rows.reverse();
  }

  async sendMessage(senderId: string, roomId: string, data: SendMessageData) {
    // Verify sender is in room
    const member = await query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND is_active = true',
      [roomId, senderId]
    );
    if (!member.rows[0]) throw new AppError('Access denied', 403);

    if (!data.content && !data.attachmentUrl) {
      throw new AppError('Message must have content or attachment', 400);
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = data.content ? xss(data.content) : null;

    // Run moderation check (stub - see moderation.service.ts)
    if (sanitizedContent) {
      const modResult = await moderationService.checkContent(sanitizedContent);
      if (modResult.blocked) {
        throw new AppError('Message blocked by moderation', 400);
      }
    }

    const id = uuidv4();
    const expiresAt = data.ttl ? new Date(Date.now() + data.ttl * 1000) : null;

    const result = await query<{
      id: string;
      sender_id: string;
      room_id: string;
      content: string | null;
      attachment_url: string | null;
      attachment_type: string | null;
      status: string;
      reply_to_id: string | null;
      expires_at: Date | null;
      created_at: Date;
    }>(
      `INSERT INTO messages (id, sender_id, room_id, content, attachment_url, attachment_type, reply_to_id, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent')
       RETURNING *`,
      [id, senderId, roomId, sanitizedContent, data.attachmentUrl || null, data.attachmentType || null, data.replyToId || null, expiresAt]
    );

    // Update room last_message_at
    await query('UPDATE rooms SET last_message_at = NOW() WHERE id = $1', [roomId]);

    // Async translation for room members (fire and forget)
    if (sanitizedContent) {
      this.translateForRoomMembers(id, sanitizedContent, roomId, senderId).catch(err =>
        logger.warn('Translation failed:', err)
      );
    }

    return result.rows[0];
  }

  /**
   * Translate message content for each room member's preferred language (stub)
   */
  private async translateForRoomMembers(
    messageId: string,
    content: string,
    roomId: string,
    senderId: string
  ): Promise<void> {
    const members = await query<{ user_id: string; preferred_lang: string | null }>(
      `SELECT rm.user_id, u.preferred_lang
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = $1 AND rm.user_id != $2 AND rm.is_active = true`,
      [roomId, senderId]
    );

    for (const member of members.rows) {
      if (member.preferred_lang) {
        const translation = await translationService.translate(content, member.preferred_lang);
        if (translation) {
          await query(
            `INSERT INTO message_translations (message_id, language, translated_content, confidence)
             VALUES ($1, $2, $3, $4) ON CONFLICT (message_id, language) DO NOTHING`,
            [messageId, member.preferred_lang, translation.text, translation.confidence]
          );
        }
      }
    }
  }

  async markRead(roomId: string, userId: string): Promise<void> {
    await query(
      `UPDATE room_members SET last_read_at = NOW() WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    // Update delivery receipts
    await query(
      `UPDATE messages SET status = 'read'
       WHERE room_id = $1 AND sender_id != $2 AND status != 'read'`,
      [roomId, userId]
    );
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const result = await query(
      'SELECT sender_id FROM messages WHERE id = $1',
      [messageId]
    );
    if (!result.rows[0]) throw new AppError('Message not found', 404);
    if (result.rows[0].sender_id !== userId) throw new AppError('Cannot delete others\' messages', 403);
    await query('UPDATE messages SET is_deleted = true WHERE id = $1', [messageId]);
  }
}
