/**
 * Authentication service: handles user registration, login, and token management
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { redisSet, redisGet, redisDel } from '../config/redis';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  };
}

export class AuthService {
  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string, displayName: string): Promise<AuthTokens> {
    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError('Email already in use', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    const result = await query<{ id: string; email: string; display_name: string; avatar_url: string | null; role: string }>(
      `INSERT INTO users (id, email, password_hash, display_name, role, is_active)
       VALUES ($1, $2, $3, $4, 'user', true)
       RETURNING id, email, display_name, avatar_url, role`,
      [id, email, passwordHash, displayName]
    );

    const user = result.rows[0];
    logger.info(`New user registered: ${email}`);
    return this.generateTokensForUser(user);
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    const result = await query<{
      id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
      role: string;
      password_hash: string;
      is_active: boolean;
      is_banned: boolean;
    }>(
      'SELECT id, email, display_name, avatar_url, role, password_hash, is_active, is_banned FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.is_active) {
      throw new AppError('Account deactivated', 403);
    }

    if (user.is_banned) {
      throw new AppError('Account banned', 403);
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Update last seen
    await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    return this.generateTokensForUser(user);
  }

  /**
   * Generate access and refresh tokens for a user
   */
  async generateTokensForUser(user: { id: string; email: string; display_name?: string; displayName?: string; avatar_url?: string | null; avatarUrl?: string | null; role: string }): Promise<AuthTokens> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
    const refreshToken = uuidv4();

    // Store refresh token in Redis
    await redisSet(
      `refresh:${refreshToken}`,
      JSON.stringify({ userId: user.id, email: user.email, role: user.role }),
      REFRESH_TOKEN_TTL
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.displayName || user.email,
        avatarUrl: user.avatar_url || user.avatarUrl || null,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const data = await redisGet(`refresh:${refreshToken}`);
    if (!data) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const { userId, email, role } = JSON.parse(data);

    // Rotate refresh token
    await redisDel(`refresh:${refreshToken}`);
    const newRefreshToken = uuidv4();
    await redisSet(
      `refresh:${newRefreshToken}`,
      JSON.stringify({ userId, email, role }),
      REFRESH_TOKEN_TTL
    );

    const accessToken = jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout: invalidate refresh token
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await redisDel(`refresh:${refreshToken}`);
    }
    // Update last seen
    await query('UPDATE users SET last_seen = NOW(), status = $1 WHERE id = $2', ['offline', userId]);
  }
}
