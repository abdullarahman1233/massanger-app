/**
 * Redis configuration for session caching, presence, and pub/sub
 */
import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redis: Redis;
let redisSubscriber: Redis;

export function getRedis(): Redis {
  if (!redis) throw new Error('Redis not initialized');
  return redis;
}

export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) throw new Error('Redis subscriber not initialized');
  return redisSubscriber;
}

export async function initializeRedis(): Promise<void> {
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
  };

  redis = new Redis(redisConfig);
  redisSubscriber = new Redis(redisConfig);

  await new Promise<void>((resolve, reject) => {
    redis.once('ready', resolve);
    redis.once('error', reject);
  });

  logger.info('Redis connections established');
}

/**
 * Set a key with optional TTL in seconds
 */
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await getRedis().set(key, value, 'EX', ttlSeconds);
  } else {
    await getRedis().set(key, value);
  }
}

/**
 * Get a key value
 */
export async function redisGet(key: string): Promise<string | null> {
  return getRedis().get(key);
}

/**
 * Delete a key
 */
export async function redisDel(key: string): Promise<void> {
  await getRedis().del(key);
}
