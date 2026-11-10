import { PrismaClient } from '@prisma/client';
import { getConfig } from '../config/env.js';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const config = getConfig();
    prismaInstance = new PrismaClient({
      datasourceUrl: config.DATABASE_URL,
      log: config.isDevelopment ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

export async function checkDatabaseHealth(client?: PrismaClient): Promise<boolean> {
  try {
    const db = client || getPrismaClient();
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
