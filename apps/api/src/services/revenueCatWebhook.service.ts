import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../lib/prisma.js';
import { getConfig } from '../config/env.js';
import {
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionStore,
  WebhookEventStatus,
} from '@calmeter/shared';
import type { RevenueCatWebhookPayloadDto, RevenueCatEventDto } from '@calmeter/contracts';
import { UnauthorizedError, ValidationError } from '../lib/errors.js';

export interface WebhookProcessingResult {
  status:
    | WebhookEventStatus
    | 'PROCESSED'
    | 'IGNORED_DUPLICATE'
    | 'IGNORED_OUT_OF_ORDER'
    | 'USER_NOT_FOUND';
  eventId: string;
  eventType: string;
  userId?: string;
  message?: string;
}

export class RevenueCatWebhookService {
  constructor(
    private prisma: PrismaClient = getPrismaClient(),
    private webhookAuthToken?: string,
  ) {}

  /**
   * Verifies the Authorization header from RevenueCat.
   */
  verifyWebhookAuth(authHeader?: string): void {
    const config = getConfig();
    const expectedSecret =
      this.webhookAuthToken ||
      config.REVENUECAT_WEBHOOK_AUTH_TOKEN ||
      process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;

    // If an auth token is configured, strictly verify it
    if (expectedSecret && expectedSecret.trim() !== '') {
      if (!authHeader) {
        throw new UnauthorizedError('Missing RevenueCat webhook authorization header.');
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();

      if (token !== expectedSecret) {
        throw new UnauthorizedError('Invalid RevenueCat webhook authorization credentials.');
      }
    }
  }

  /**
   * Resolves internal User record from RevenueCat app_user_id or aliases.
   */
  private async resolveUser(event: RevenueCatEventDto): Promise<{ id: string } | null> {
    const candidateIds = [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases || []),
    ].filter(Boolean) as string[];

    // 1. Try matching directly by user UUID
    const userByUuid = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: { in: candidateIds } }, { firebaseUid: { in: candidateIds } }],
      },
      select: { id: true },
    });

    if (userByUuid) return userByUuid;

    // 2. Try matching by existing subscription revenueCatAppUserId
    const sub = await this.prisma.subscription.findFirst({
      where: {
        revenueCatAppUserId: { in: candidateIds },
      },
      select: { userId: true },
    });

    return sub ? { id: sub.userId } : null;
  }

  /**
   * Maps RevenueCat store string to internal SubscriptionStore enum.
   */
  private mapStore(storeStr?: string): SubscriptionStore {
    if (!storeStr) return SubscriptionStore.UNKNOWN;
    const upper = storeStr.toUpperCase();
    if (upper.includes('APP_STORE') || upper.includes('MAC_APP_STORE'))
      return SubscriptionStore.APP_STORE;
    if (upper.includes('PLAY_STORE')) return SubscriptionStore.PLAY_STORE;
    if (upper.includes('STRIPE')) return SubscriptionStore.STRIPE;
    if (upper.includes('PROMOTIONAL')) return SubscriptionStore.PROMOTIONAL;
    return SubscriptionStore.UNKNOWN;
  }

  /**
   * Idempotently and safely processes a RevenueCat webhook event.
   */
  async processWebhookEvent(
    payload: RevenueCatWebhookPayloadDto,
  ): Promise<WebhookProcessingResult> {
    const event = payload.event;
    if (!event || !event.id) {
      throw new ValidationError('Malformed webhook payload: missing event or event.id.');
    }

    const eventId = event.id;
    const eventType = event.type;
    const eventTimestamp = new Date(event.event_timestamp_ms);

    // 1. Duplicate check (Idempotency)
    const existingEvent = await this.prisma.revenueCatWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent && existingEvent.status === WebhookEventStatus.PROCESSED) {
      return {
        status: WebhookEventStatus.IGNORED_DUPLICATE,
        eventId,
        eventType,
        userId: existingEvent.userId || undefined,
        message: 'Duplicate event already processed.',
      };
    }

    // 2. Resolve User
    const user = await this.resolveUser(event);

    if (!user) {
      // Record unlinked event for audit
      await this.prisma.revenueCatWebhookEvent.upsert({
        where: { eventId },
        create: {
          eventId,
          eventType,
          appUserId: event.app_user_id,
          eventTimestamp,
          status: WebhookEventStatus.FAILED,
          errorMessage: `User not found for app_user_id: ${event.app_user_id}`,
          rawPayload: payload as any,
        },
        update: {},
      });

      return {
        status: 'USER_NOT_FOUND',
        eventId,
        eventType,
        message: `User not found for app_user_id: ${event.app_user_id}`,
      };
    }

    const userId = user.id;

    // 3. Out-of-order check
    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (
      existingSubscription?.lastEventTimestamp &&
      eventTimestamp.getTime() < existingSubscription.lastEventTimestamp.getTime()
    ) {
      await this.prisma.revenueCatWebhookEvent.upsert({
        where: { eventId },
        create: {
          eventId,
          eventType,
          appUserId: event.app_user_id,
          userId,
          productId: event.product_id,
          periodType: event.period_type,
          eventTimestamp,
          status: WebhookEventStatus.IGNORED_OUT_OF_ORDER,
          errorMessage: `Received older event timestamp (${eventTimestamp.toISOString()}) than current (${existingSubscription.lastEventTimestamp.toISOString()}).`,
          rawPayload: payload as any,
        },
        update: {},
      });

      return {
        status: WebhookEventStatus.IGNORED_OUT_OF_ORDER,
        eventId,
        eventType,
        userId,
        message: 'Event ignored because a newer state was already applied.',
      };
    }

    // 4. Determine state transitions based on RevenueCat Event Type
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    const effectiveExpiresAt = expiresAt || existingSubscription?.expiresAt || null;
    const latestPurchaseDate = event.purchased_at_ms ? new Date(event.purchased_at_ms) : null;
    const store = this.mapStore(event.store);
    const effectiveStore =
      store !== SubscriptionStore.UNKNOWN
        ? store
        : (existingSubscription?.store as SubscriptionStore) || SubscriptionStore.UNKNOWN;
    const isSandbox = event.environment?.toUpperCase() === 'SANDBOX';

    let targetStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE;
    let targetTier: SubscriptionTier = SubscriptionTier.PREMIUM;
    let autoRenew = true;
    let billingIssueDetectedAt: Date | null = null;
    let cancelReason: string | null = null;

    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
        targetStatus = SubscriptionStatus.ACTIVE;
        targetTier = SubscriptionTier.PREMIUM;
        autoRenew = true;
        break;

      case 'TRIAL_STARTED':
        targetStatus = SubscriptionStatus.TRIAL;
        targetTier = SubscriptionTier.PREMIUM;
        autoRenew = true;
        break;

      case 'UNCANCELLATION':
        targetStatus = SubscriptionStatus.ACTIVE;
        targetTier = SubscriptionTier.PREMIUM;
        autoRenew = true;
        cancelReason = null;
        break;

      case 'CANCELLATION':
        targetStatus = SubscriptionStatus.CANCELED;
        // Invariant: keep tier as PREMIUM if expiration is in future!
        targetTier =
          effectiveExpiresAt && effectiveExpiresAt.getTime() > Date.now()
            ? SubscriptionTier.PREMIUM
            : SubscriptionTier.FREE;
        autoRenew = false;
        cancelReason = event.cancel_reason || 'UNSUBSCRIBE';
        break;

      case 'EXPIRATION':
        targetStatus = SubscriptionStatus.EXPIRED;
        targetTier = SubscriptionTier.FREE;
        autoRenew = false;
        cancelReason = event.cancel_reason || 'EXPIRED';
        break;

      case 'BILLING_ISSUE':
        targetStatus = SubscriptionStatus.PAST_DUE;
        // Keep current tier temporarily during grace period or set based on expiration
        targetTier =
          effectiveExpiresAt && effectiveExpiresAt.getTime() > Date.now()
            ? SubscriptionTier.PREMIUM
            : SubscriptionTier.FREE;
        billingIssueDetectedAt = eventTimestamp;
        break;

      case 'SUBSCRIPTION_PAUSED':
        targetStatus = SubscriptionStatus.PAST_DUE;
        targetTier = SubscriptionTier.FREE;
        autoRenew = false;
        break;

      case 'TEST':
        // Safe ping event
        break;

      default:
        // Default to active premium if valid expiration in future
        if (effectiveExpiresAt && effectiveExpiresAt.getTime() > Date.now()) {
          targetStatus = SubscriptionStatus.ACTIVE;
          targetTier = SubscriptionTier.PREMIUM;
        }
        break;
    }

    // 5. Transactional application
    await this.prisma.$transaction(async tx => {
      // Save Webhook Event log
      await tx.revenueCatWebhookEvent.upsert({
        where: { eventId },
        create: {
          eventId,
          eventType,
          appUserId: event.app_user_id,
          userId,
          productId: event.product_id,
          periodType: event.period_type,
          eventTimestamp,
          status: WebhookEventStatus.PROCESSED,
          rawPayload: payload as any,
        },
        update: {
          status: WebhookEventStatus.PROCESSED,
          userId,
        },
      });

      // Upsert Subscription state
      await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          revenueCatAppUserId: event.app_user_id,
          tier: targetTier,
          status: targetStatus,
          store: effectiveStore,
          planId: event.product_id?.includes('annual') ? 'annual_premium' : 'monthly_premium',
          productId: event.product_id,
          entitlementId: 'premium_access',
          originalPurchaseDate: latestPurchaseDate,
          latestPurchaseDate,
          expiresAt: effectiveExpiresAt,
          autoRenewStatus: autoRenew,
          isSandbox,
          billingIssueDetectedAt,
          cancelReason,
          lastEventTimestamp: eventTimestamp,
          rawPayload: payload as any,
        },
        update: {
          revenueCatAppUserId: event.app_user_id,
          tier: targetTier,
          status: targetStatus,
          store: effectiveStore,
          planId: event.product_id?.includes('annual') ? 'annual_premium' : 'monthly_premium',
          productId: event.product_id,
          latestPurchaseDate: latestPurchaseDate || undefined,
          expiresAt: effectiveExpiresAt,
          autoRenewStatus: autoRenew,
          isSandbox,
          billingIssueDetectedAt,
          cancelReason,
          lastEventTimestamp: eventTimestamp,
          rawPayload: payload as any,
        },
      });
    });

    return {
      status: WebhookEventStatus.PROCESSED,
      eventId,
      eventType,
      userId,
      message: 'Subscription state updated successfully.',
    };
  }
}
