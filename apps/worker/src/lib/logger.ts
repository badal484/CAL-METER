import pino from 'pino';
import { getWorkerConfig } from '../config/env.js';

const config = getWorkerConfig();

export const workerLogger = pino({
  name: 'calmeter-worker',
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
});
