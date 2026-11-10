import { Redis } from 'ioredis';
import { getConfig } from '../config/env.js';
import { logger } from './logger.js';

let redisInstance: Redis | null = null;

export function createRedisClient(url?: string): Redis {
  const config = getConfig();
  const redisUrl = url || config.REDIS_URL;

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) {
        logger.warn({ times }, 'Redis connection retry limit reached');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
  });

  client.on('error', err => {
    logger.error({ err: err.message }, 'Redis client connection error');
  });

  return client;
}

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = createRedisClient();
  }
  return redisInstance;
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    try {
      await redisInstance.quit();
    } catch {
      redisInstance.disconnect();
    }
    redisInstance = null;
  }
}

export async function checkRedisHealth(client?: Redis): Promise<boolean> {
  try {
    const redis = client || getRedisClient();
    if (redis.status !== 'ready') {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
