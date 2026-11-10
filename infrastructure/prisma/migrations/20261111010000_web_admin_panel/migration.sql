-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'NUTRITION_EDITOR', 'SUPPORT_ADMIN');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('ACCOUNT_BILLING', 'FOOD_DATABASE', 'AI_SCAN_FAILURE', 'BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL_INQUIRY');

-- CreateEnum
CREATE TYPE "NotificationCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "is_suspended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "suspended_at" TIMESTAMPTZ(6),
  ADD COLUMN "suspension_reason" TEXT;

-- CreateIndex
CREATE INDEX "users_is_suspended_idx" ON "users"("is_suspended");

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_resource" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(100),
    "details" JSONB,
    "reason" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "request_id" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "user_email" VARCHAR(255),
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'GENERAL_INQUIRY',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "assigned_admin_id" UUID,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'DAILY_SUMMARY',
    "deep_link" VARCHAR(255),
    "target_audience" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "status" "NotificationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "total_targeted" INTEGER NOT NULL DEFAULT 0,
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_failed" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "food_item_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "cuisine" VARCHAR(50) NOT NULL DEFAULT 'INDIAN_NORTH',
    "dietary_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    "servings" INTEGER NOT NULL DEFAULT 2,
    "prep_time_minutes" INTEGER NOT NULL DEFAULT 15,
    "cook_time_minutes" INTEGER NOT NULL DEFAULT 20,
    "difficulty" VARCHAR(20) NOT NULL DEFAULT 'EASY',
    "instructions" JSONB NOT NULL,
    "ingredients" JSONB NOT NULL,
    "calories_per_serving" DECIMAL(8,2),
    "protein_per_serving" DECIMAL(8,2),
    "carbs_per_serving" DECIMAL(8,2),
    "fat_per_serving" DECIMAL(8,2),
    "fiber_per_serving" DECIMAL(8,2),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_firebase_uid_key" ON "admin_users"("firebase_uid");
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX "admin_users_role_is_active_idx" ON "admin_users"("role", "is_active");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_created_at_idx" ON "admin_audit_logs"("admin_id", "created_at" DESC);
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at" DESC);
CREATE INDEX "admin_audit_logs_target_resource_target_id_idx" ON "admin_audit_logs"("target_resource", "target_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");
CREATE INDEX "support_tickets_user_id_created_at_idx" ON "support_tickets"("user_id", "created_at" DESC);
CREATE INDEX "support_tickets_assigned_admin_id_status_idx" ON "support_tickets"("assigned_admin_id", "status");

-- CreateIndex
CREATE INDEX "support_ticket_notes_ticket_id_created_at_idx" ON "support_ticket_notes"("ticket_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "notification_campaigns_status_scheduled_at_idx" ON "notification_campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "recipes_cuisine_is_published_idx" ON "recipes"("cuisine", "is_published");
CREATE INDEX "recipes_title_idx" ON "recipes"("title");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
