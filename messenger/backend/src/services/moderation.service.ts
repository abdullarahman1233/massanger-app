/**
 * Moderation Service - Stub implementation
 * 
 * To wire a real AI moderation provider (e.g., OpenAI Moderation API):
 * 1. Set MODERATION_PROVIDER=openai and OPENAI_API_KEY in .env
 * 2. Install: npm install openai
 * 3. Replace the stub logic below with actual API calls
 * 
 * Example with OpenAI:
 *   import OpenAI from 'openai';
 *   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *   const result = await openai.moderations.create({ input: content });
 *   return { blocked: result.results[0].flagged, reason: 'openai_moderation' };
 */
import { logger } from '../utils/logger';

interface ModerationResult {
  blocked: boolean;
  reason?: string;
  score?: number;
}

// Simple word blocklist for demonstration
const BLOCKED_PATTERNS = [
  /\b(spam|scam)\b/i,
];

export class ModerationService {
  /**
   * Check content for policy violations
   * Returns { blocked: true, reason } if content should be blocked
   */
  async checkContent(content: string): Promise<ModerationResult> {
    const provider = process.env.MODERATION_PROVIDER;

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return this.checkWithOpenAI(content);
    }

    // Stub: simple pattern matching
    return this.stubCheck(content);
  }

  private stubCheck(content: string): ModerationResult {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(content)) {
        return { blocked: true, reason: 'blocked_pattern', score: 1.0 };
      }
    }
    return { blocked: false, score: 0.0 };
  }

  private async checkWithOpenAI(content: string): Promise<ModerationResult> {
    // TODO: Implement with real OpenAI API key
    // This is a placeholder showing the intended structure
    logger.info('OpenAI moderation check (stub)');
    return { blocked: false, score: 0.0 };
  }

  /**
   * Add message to moderation queue for human review
   */
  async queueForReview(messageId: string, reason: string): Promise<void> {
    // Insert into moderation_queue table
    const { query: dbQuery } = await import('../config/database');
    await dbQuery(
      `INSERT INTO moderation_queue (message_id, reason, status)
       VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`,
      [messageId, reason]
    );
  }
}
