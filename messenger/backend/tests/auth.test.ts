/**
 * Integration tests for authentication endpoints
 */
import request from 'supertest';
import { app } from '../src/app';

// Mock database and redis for unit tests
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
  initializeDatabase: jest.fn(),
  getPool: jest.fn(),
}));

jest.mock('../src/config/redis', () => ({
  initializeRedis: jest.fn(),
  getRedis: jest.fn(),
  redisSet: jest.fn(),
  redisGet: jest.fn(),
  redisDel: jest.fn(),
}));

import { query } from '../src/config/database';
import { redisSet, redisGet } from '../src/config/redis';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRedisSet = redisSet as jest.MockedFunction<typeof redisSet>;

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'pass1234', displayName: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: 'short', displayName: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should reject if email already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }], rowCount: 1 });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@test.com', password: 'password123', displayName: 'Test User' });

      expect(res.status).toBe(409);
    });

    it('should register successfully', async () => {
      // No existing user
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // Insert user
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-uuid', email: 'new@test.com', display_name: 'New User', avatar_url: null, role: 'user' }],
        rowCount: 1,
      });
      mockRedisSet.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.com', password: 'password123', displayName: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('new@test.com');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' }); // missing password

      expect(res.status).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no user found

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limit headers', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password' });

      // Rate limit headers should be present
      expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});
