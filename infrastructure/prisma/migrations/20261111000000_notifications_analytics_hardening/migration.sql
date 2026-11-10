-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM (
    'MEAL_REMINDER_BREAKFAST',
    'MEAL_REMINDER_LUNCH',
    'MEAL_REMINDER_DINNER',
    'WATER_REMINDER',
    'DAILY_SUMMARY',
    'WEEKLY_SUMMARY',
    'WEIGHT_REMINDER',
    'COACH_INSIGHT',
    'SUBSCRIPTION_LIFECYCLE',
    'ACCOUNT_SECURITY'
);

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED',
    'SKIPPED_QUIET_HOURS',
    'SKIPPED_PREFERENCE'
);

-- CreateEnum
CREATE TYPE "AnalyticsEventName" AS ENUM (
    'USER_REGISTERED',
    'ONBOARDING_STARTED',
    'ONBOARDING_COMPLETED',
    'FOOD_SEARCH_PERFORMED',
    'DIARY_ENTRY_CREATED',
    'DIARY_ENTRY_UPDATED',
    'DIARY_ENTRY_DELETED',
    'PHOTO_SCAN_INITIATED',
    'PHOTO_SCAN_COMPLETED',
    'BARCODE_SCAN_COMPLETED',
    'COACH_MESSAGE_SENT',
    'INSIGHT_VIEWED',
    'MEAL_RECOMMENDATION_ACCEPTED',
    'PAYWALL_VIEWED',
    'PURCHASE_INITIATED',
    'PURCHASE_COMPLETED',
    'PURCHASE_RESTORED',
    'WEIGHT_LOGGED',
    'WATER_LOGGED',
    'EXERCISE_LOGGED'
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'ANDROID',
    "device_model" VARCHAR(100),
    "os_version" VARCHAR(50),
    "app_version" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "meal_reminders" BOOLEAN NOT NULL DEFAULT true,
    "breakfast_reminder" BOOLEAN NOT NULL DEFAULT true,
    "lunch_reminder" BOOLEAN NOT NULL DEFAULT true,
    "dinner_reminder" BOOLEAN NOT NULL DEFAULT true,
    "water_reminders" BOOLEAN NOT NULL DEFAULT true,
    "daily_summary" BOOLEAN NOT NULL DEFAULT true,
    "weekly_summary" BOOLEAN NOT NULL DEFAULT true,
    "weight_reminders" BOOLEAN NOT NULL DEFAULT true,
    "coach_insights" BOOLEAN NOT NULL DEFAULT true,
    "subscription_updates" BOOLEAN NOT NULL DEFAULT true,
    "breakfast_time" VARCHAR(5) NOT NULL DEFAULT '08:30',
    "lunch_time" VARCHAR(5) NOT NULL DEFAULT '13:00',
    "dinner_time" VARCHAR(5) NOT NULL DEFAULT '20:00',
    "daily_summary_time" VARCHAR(5) NOT NULL DEFAULT '21:30',
    "weight_reminder_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "weekly_summary_day" INTEGER NOT NULL DEFAULT 0,
    "water_interval_hours" INTEGER NOT NULL DEFAULT 2,
    "water_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "water_end_time" VARCHAR(5) NOT NULL DEFAULT '21:00',
    "quiet_hours_start" VARCHAR(5) DEFAULT '22:00',
    "quiet_hours_end" VARCHAR(5) DEFAULT '07:00',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "device_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_name" VARCHAR(100) NOT NULL,
    "properties" JSONB NOT NULL,
    "device_platform" VARCHAR(20),
    "app_version" VARCHAR(50),
    "session_id" VARCHAR(100),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX "device_tokens_user_id_is_active_idx" ON "device_tokens"("user_id", "is_active");
CREATE INDEX "device_tokens_token_idx" ON "device_tokens"("token");
CREATE INDEX "device_tokens_last_seen_at_idx" ON "device_tokens"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notification_history_user_id_created_at_idx" ON "notification_history"("user_id", "created_at" DESC);
CREATE INDEX "notification_history_category_status_idx" ON "notification_history"("category", "status");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_timestamp_idx" ON "analytics_events"("user_id", "timestamp" DESC);
CREATE INDEX "analytics_events_event_name_timestamp_idx" ON "analytics_events"("event_name", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
