import { Redis, type RedisOptions } from 'ioredis';
import { getWorkerConfig } from '../config/env.js';

export function getBullMQRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
  };
}

export function createWorkerRedisConnection(url?: string): Redis {
  const config = getWorkerConfig();
  return new Redis(url || config.REDIS_URL, getBullMQRedisOptions());
}
