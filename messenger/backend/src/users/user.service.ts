/**
 * User service: profile management, presence, search
 */
import { query } from '../config/database';
import { AppError } from '../utils/errors';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  status: string;
  role: string;
  lastSeen: Date;
  createdAt: Date;
}

interface UpdateProfileData {
  displayName?: string;
  bio?: string;
  status?: string;
  avatarUrl?: string;
}

export class UserService {
  async getUserById(id: string): Promise<UserProfile> {
    const result = await query<{
      id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
      bio: string | null;
      status: string;
      role: string;
      last_seen: Date;
      created_at: Date;
    }>(
      `SELECT id, email, display_name, avatar_url, bio, status, role, last_seen, created_at
       FROM users WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (!result.rows[0]) {
      throw new AppError('User not found', 404);
    }

    const u = result.rows[0];
    return {
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      status: u.status,
      role: u.role,
      lastSeen: u.last_seen,
      createdAt: u.created_at,
    };
  }

  async updateProfile(id: string, data: UpdateProfileData): Promise<UserProfile> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.displayName !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(data.displayName);
    }
    if (data.bio !== undefined) {
      fields.push(`bio = $${idx++}`);
      values.push(data.bio);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${idx++}`);
      values.push(data.avatarUrl);
    }

    if (fields.length === 0) {
      return this.getUserById(id);
    }

    values.push(id);
    await query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
      values
    );

    return this.getUserById(id);
  }

  async searchUsers(searchQuery: string): Promise<UserProfile[]> {
    const result = await query<{
      id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
      bio: string | null;
      status: string;
      role: string;
      last_seen: Date;
      created_at: Date;
    }>(
      `SELECT id, email, display_name, avatar_url, bio, status, role, last_seen, created_at
       FROM users
       WHERE is_active = true
         AND (display_name ILIKE $1 OR email ILIKE $1)
       LIMIT 20`,
      [`%${searchQuery}%`]
    );

    return result.rows.map(u => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      status: u.status,
      role: u.role,
      lastSeen: u.last_seen,
      createdAt: u.created_at,
    }));
  }
}
