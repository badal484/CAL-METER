import pino from 'pino';
import { getConfig } from '../config/env.js';

const config = getConfig();

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'authorization',
      'cookie',
      'token',
      'idToken',
      'refreshToken',
      'password',
      'secret',
      'apiKey',
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
