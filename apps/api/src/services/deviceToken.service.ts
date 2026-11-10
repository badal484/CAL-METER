import type { PrismaClient } from '@prisma/client';
import type { RegisterDeviceTokenInput } from '@calmeter/contracts';

export class DeviceTokenService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Registers or updates a device token.
   * If the device was previously associated with another user (e.g. account switch),
   * ownership is re-assigned to the currently authenticated user.
   */
  async registerToken(userId: string, input: RegisterDeviceTokenInput) {
    const existing = await this.prisma.deviceToken.findUnique({
      where: { token: input.token },
    });

    if (existing) {
      return this.prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
          userId,
          platform: input.platform,
          deviceModel: input.deviceModel ?? null,
          osVersion: input.osVersion ?? null,
          appVersion: input.appVersion ?? null,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });
    }

    return this.prisma.deviceToken.create({
      data: {
        userId,
        token: input.token,
        platform: input.platform,
        deviceModel: input.deviceModel ?? null,
        osVersion: input.osVersion ?? null,
        appVersion: input.appVersion ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Deactivates a single device token (e.g. during user logout).
   */
  async deactivateToken(userId: string, token: string) {
    return this.prisma.deviceToken.updateMany({
      where: {
        userId,
        token,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Retrieves active FCM tokens for a user.
   */
  async getActiveTokensForUser(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        token: true,
        platform: true,
      },
    });
  }

  /**
   * Marks invalid/unregistered FCM tokens as inactive.
   */
  async markTokensInactive(tokens: string[]) {
    if (!tokens.length) return { count: 0 };
    return this.prisma.deviceToken.updateMany({
      where: {
        token: { in: tokens },
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Removes stale inactive device tokens older than the specified retention window.
   */
  async cleanupStaleTokens(staleDays: number = 90) {
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    return this.prisma.deviceToken.deleteMany({
      where: {
        isActive: false,
        lastSeenAt: { lt: cutoff },
      },
    });
  }
}
