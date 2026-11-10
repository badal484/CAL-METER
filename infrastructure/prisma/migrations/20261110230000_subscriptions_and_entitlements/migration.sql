-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStore" AS ENUM ('APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMOTIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSED', 'IGNORED_DUPLICATE', 'IGNORED_OUT_OF_ORDER', 'FAILED');

-- CreateEnum
CREATE TYPE "FeatureKey" AS ENUM ('AI_PHOTO_SCAN', 'BARCODE_SCAN', 'NUTRITION_LABEL_SCAN', 'COACH_CHAT', 'PERSONALIZED_INSIGHTS', 'HISTORY_RANGE', 'MEAL_RECOMMENDATIONS', 'ADVANCED_ANALYTICS');

-- AlterTable
ALTER TABLE "subscriptions"
  ADD COLUMN "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "store" "SubscriptionStore" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "product_id" TEXT,
  ADD COLUMN "entitlement_id" TEXT DEFAULT 'premium_access',
  ADD COLUMN "original_purchase_date" TIMESTAMP(3),
  ADD COLUMN "latest_purchase_date" TIMESTAMP(3),
  ADD COLUMN "auto_renew_status" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_sandbox" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "billing_issue_detected_at" TIMESTAMP(3),
  ADD COLUMN "last_event_timestamp" TIMESTAMP(3),
  ADD COLUMN "raw_payload" JSONB;

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_tier_idx" ON "subscriptions"("user_id", "tier");

-- CreateTable
CREATE TABLE "revenuecat_webhook_events" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "app_user_id" VARCHAR(128) NOT NULL,
    "user_id" UUID,
    "product_id" VARCHAR(128),
    "period_type" VARCHAR(32),
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSED',
    "error_message" TEXT,
    "raw_payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenuecat_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revenuecat_webhook_events_event_id_key" ON "revenuecat_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "revenuecat_webhook_events_app_user_id_idx" ON "revenuecat_webhook_events"("app_user_id");

-- CreateIndex
CREATE INDEX "revenuecat_webhook_events_user_id_idx" ON "revenuecat_webhook_events"("user_id");

-- CreateIndex
CREATE INDEX "revenuecat_webhook_events_event_type_idx" ON "revenuecat_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "revenuecat_webhook_events_event_timestamp_idx" ON "revenuecat_webhook_events"("event_timestamp" DESC);

-- CreateTable
CREATE TABLE "user_feature_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "feature" "FeatureKey" NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feature_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_feature_usage_user_id_date_idx" ON "user_feature_usage"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_feature_usage_user_id_feature_date_key" ON "user_feature_usage"("user_id", "feature", "date");

-- AddForeignKey
ALTER TABLE "revenuecat_webhook_events" ADD CONSTRAINT "revenuecat_webhook_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feature_usage" ADD CONSTRAINT "user_feature_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
