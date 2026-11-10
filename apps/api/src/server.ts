import type { Server } from 'node:http';
import { createApp } from './app.js';
import { getConfig } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';

const config = getConfig();
const app = createApp();

let server: Server | null = null;

export function startServer(): Server {
  server = app.listen(config.PORT, config.HOST, () => {
    logger.info(
      {
        port: config.PORT,
        host: config.HOST,
        env: config.NODE_ENV,
      },
      'CAL METER API server running',
    );
  });

  return server;
}

export async function stopServer(): Promise<void> {
  logger.info('Initiating graceful shutdown of API server...');

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close(err => {
        if (err) return reject(err);
        resolve();
      });
    });
    server = null;
    logger.info('HTTP server closed.');
  }

  await disconnectPrisma();
  logger.info('Prisma database client disconnected.');

  await disconnectRedis();
  logger.info('Redis client disconnected.');

  logger.info('Graceful shutdown completed.');
}

// Handle termination signals if this is the main executed module
if (process.env.NODE_ENV !== 'test') {
  startServer();

  const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  shutdownSignals.forEach(signal => {
    process.on(signal, async () => {
      logger.info({ signal }, 'Termination signal received');
      try {
        await stopServer();
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  });
}
