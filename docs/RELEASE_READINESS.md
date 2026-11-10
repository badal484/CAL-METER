# CAL METER — PRODUCTION RELEASE READINESS, STORE GUIDES & INFRASTRUCTURE RUNBOOK

**Target Version:** 1.0.0 (Build 1)  
**Application ID / Bundle ID:** `com.calmeter.app`  
**Target Environments:** Google Play Store (Android) & Apple App Store (iOS)  
**Date of Audit:** 2026-11-11  
**Auditor:** Principal Software Architect, Senior QA, Security & DevOps Release Auditor

---

## 1. Executive Summary & Verification Matrix

CAL METER is an AI-powered personal nutrition and calorie tracking platform engineered as an npm monorepo with strict architectural boundaries. The mobile app is built with React Native CLI, backed by a Node.js/Express REST API, PostgreSQL database with Prisma ORM, Redis BullMQ background workers, and a dedicated Web Operations Admin Panel.

### Verification Status Matrix

| Component                 | Architecture / Technology            | Verified Passing      | Status                          |
| :------------------------ | :----------------------------------- | :-------------------- | :------------------------------ |
| **Domain Logic**          | `@calmeter/shared` (Vitest)          | 195 / 195             | Verified Deterministic          |
| **API Contracts**         | `@calmeter/contracts` (Vitest)       | 98 / 98               | 100% Zod Schema Coverage        |
| **Mobile Client**         | `@calmeter/mobile` (Vitest)          | 81 / 81               | React 19.3 + Navigation Passing |
| **Backend API**           | `@calmeter/api` (Vitest + Supertest) | 322 / 322             | Multi-Tenant Isolated           |
| **Background Queue**      | `@calmeter/worker` (BullMQ + Vitest) | 8 / 8                 | Idempotent Jobs Passing         |
| **Operations Panel**      | `@calmeter/admin` (Vite + React 19)  | 5 / 5                 | Full RBAC Tested                |
| **Total Automated Tests** | **Full Monorepo**                    | **709 / 709 Passing** | **100% Green Pipeline**         |

---

## 2. Google Play Store Readiness Guide

### 2.1. Store Listing Metadata

- **App Name:** CAL METER: Calorie & Macro AI
- **Short Description (80 chars max):**
  > Snap meals, scan barcodes & track calories with your private AI nutrition coach.
- **Full Description (4,000 chars max):**
  > CAL METER is the intelligent, privacy-first nutrition companion designed to make health and calorie tracking effortless, whether you are dining at home in India or traveling worldwide.
  >
  > 🥗 **Effortless Meal Logging**
  >
  > - Photo Meal Scanner: Capture a picture of your plate. Computer vision identifies dishes (including complex Indian regional curries, rotis, dals, and international cuisine) and estimates portions.
  > - Instant Barcode Scanner: Scan packaged foods to retrieve verified nutrition facts, serving sizes, and allergens from canonical food databases.
  > - Verified Food Catalog: Thousands of thoroughly curated whole foods, restaurant meals, and packaged brands with complete macronutrient breakdowns.
  >
  > 🎯 **Personalized Nutrition & Targets**
  >
  > - Clinically validated BMR (Mifflin-St Jeor) and TDEE calculations based on your age, biological sex, height, weight, and activity level.
  > - Dynamic calorie targets and macronutrient splits (Protein, Carbohydrates, Healthy Fats, and Dietary Fiber) tailored to your goals: Weight Loss, Muscle Gain, or Maintenance.
  > - Daily nutrition summaries with macro progress bars and hydration tracking.
  >
  > 🤖 **Private AI Nutrition Coach**
  >
  > - Ask questions about your day’s eating, receive personalized meal recommendations that fit your remaining calorie budget, and identify nutritional gaps.
  > - Non-judgmental, evidence-based guidance with zero medical prescriptions or extreme crash diet advice.
  >
  > 💧 **Complete Wellness Tracking**
  >
  > - Daily water logging with customizable volume units (ml, L, fl oz).
  > - Weight trend tracking with historical charts and pace analysis.
  > - Exercise logging to capture active minutes and workout habits.
  >
  > 🔒 **Privacy by Design**
  >
  > - Your health data is yours. We never sell your personal data or biometric information to third parties.
  > - Zero-PII analytics: credentials and private logs are never shared.
  > - Permanent in-app account deletion available anytime.
- **Category:** Health & Fitness
- **Tags:** Calorie Counter, Macro Tracker, Diet Tracker, Nutrition, Indian Food Calories, Barcode Scanner, AI Diet Coach.

### 2.2. Graphical Assets Specifications

1. **App Icon:**
   - Format: 512 x 512 px, 32-bit PNG. Max size: 1024 KB.
   - Design: Modern CAL METER biometric shield icon on emerald-to-navy gradient.
2. **Feature Graphic:**
   - Format: 1024 x 500 px, 24-bit PNG or JPEG.
   - Content: Hero mockup of mobile diary dashboard with macro ring and camera food scanner preview.
3. **Phone Screenshots (Minimum 4, Recommended 8):**
   - Format: 1080 x 2400 px (16:9 or 20:9 aspect ratio), 24-bit PNG.
   - Screen 1: Daily Food Diary with remaining calorie breakdown.
   - Screen 2: AI Photo Food Scanner identifying meal items.
   - Screen 3: Barcode scanner matching packaged snacks.
   - Screen 4: Macro targets and nutritional analytics.
   - Screen 5: AI Nutrition Coach conversational meal recommendation.
   - Screen 6: Water and weight trend tracking charts.
   - Screen 7: Onboarding personalization questionnaire.
   - Screen 8: Dark mode support and privacy controls.

### 2.3. Content Rating (IARC)

- **Audience:** Everyone (General Audience).
- **Violence, Sexual Content, Controlled Substances:** None.
- **User Interactions:** AI chat provides educational nutrition advice; no unmoderated public user-to-user chat.
- **Clinical Notice:** Explicitly declares educational wellness disclaimer; restricts onboarding to adults aged 18 and older.

### 2.4. Target Audience & Target SDK

- **Target Audience:** Adults 18+. Minors under 18 are rejected during onboarding per clinical Mifflin-St Jeor safety bounds.
- **Minimum SDK:** 24 (Android 7.0 Nougat).
- **Target SDK:** 36 (Android 14+ / 15 ready).
- **Compile SDK:** 37.

### 2.5. Permissions Rationale (Google Play Policy)

| Permission                              | Android API Level     | Justification / Usage                                                                                                     |
| :-------------------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `android.permission.INTERNET`           | All                   | Fetch verified food catalog, sync diary entries, authenticate via Firebase, and query AI services.                        |
| `android.permission.CAMERA`             | All                   | Real-time barcode scanning and photo food recognition. Only accessed when user taps camera triggers.                      |
| `android.permission.POST_NOTIFICATIONS` | API 33+ (Android 13+) | Daily meal check-ins, water hydration reminders, and evening nutrition summaries scheduled according to user quiet hours. |

### 2.6. Data Safety Declaration (Google Play)

- **Data Collected:**
  - _Personal Info:_ Name, Email address, User IDs (Account Management).
  - _Health & Fitness:_ Weight, height, date of birth, dietary preferences, logged foods, water intake, exercise minutes (App Functionality, Personalization).
  - _Photos:_ Food meal photos (Optional, only processed for AI nutrition scanning, not retained permanently).
  - _App Performance:_ Anonymous crash logs and operational latency metrics.
- **Data Sharing:** **NO data shared with third parties** for advertising or marketing.
- **Security Practices:**
  - Data encrypted in transit using standard TLS 1.3.
  - Data encrypted at rest in managed PostgreSQL.
  - In-app Account Deletion: Users can request complete deletion directly in Profile settings.

---

## 3. Apple App Store Readiness Guide

### 3.1. App Store Metadata

- **App Name:** CAL METER: Calorie & Macro AI
- **Subtitle (30 chars max):** Smart Food Scanner & Diary
- **Bundle ID:** `com.calmeter.app`
- **SKU:** `CALMETER-IOS-001`
- **Primary Category:** Health & Fitness
- **Secondary Category:** Lifestyle
- **Content Rights:** Yes, own and have all rights to proprietary algorithms and licensed food datasets.
- **Age Rating:** 17+ (Unrestricted Web Access is NO; Health & Fitness informational disclaimer is YES).

### 3.2. Privacy Nutrition Labels (App Store Privacy Information)

| Data Category        | Data Type                      | Linked to User  | Used for Tracking | Purpose                                   |
| :------------------- | :----------------------------- | :-------------- | :---------------- | :---------------------------------------- |
| **Contact Info**     | Email Address, Name            | YES             | NO                | App Functionality, Account Authentication |
| **Health & Fitness** | Fitness, Nutrition, Biometrics | YES             | NO                | Core App Functionality, Personalization   |
| **User Content**     | Photos (Meal captures)         | YES             | NO                | Core App Functionality (AI meal scanning) |
| **Identifiers**      | User ID, Device Token          | YES             | NO                | Push Notifications, Account Management    |
| **Diagnostics**      | Crash Data, Performance        | NO (Anonymized) | NO                | App Reliability & Performance             |

**Apple Privacy Manifest (`PrivacyInfo.xcprivacy`):**

- Configured at `apps/mobile/ios/CalMeter/PrivacyInfo.xcprivacy`.
- `NSPrivacyTracking`: `false`
- Accessed API Reasons:
  - `NSPrivacyAccessedAPICategoryFileTimestamp`: Reason `C617.1` (Local cache management)
  - `NSPrivacyAccessedAPICategorySystemBootTime`: Reason `35F9.1` (Performance measurement)
  - `NSPrivacyAccessedAPICategoryUserDefaults`: Reason `CA92.1` (Theme preference storage)

### 3.3. App Store Guideline Compliance Checklist

1. **Guideline 5.1.1(v) — In-App Account Deletion:**
   - Implemented at `apps/mobile/src/features/profile/ProfileScreen.tsx` with high-visibility red "Delete Account" button.
   - Connected to authenticated backend endpoint `DELETE /api/v1/profile`.
   - Soft-deletes user, creates a 30-day purge schedule in `deletion_requests`, deletes notification device tokens, and invalidates active session.
2. **Guideline 3.1.1 — In-App Purchase & Auto-Renewable Subscriptions:**
   - Managed via RevenueCat SDK (`react-native-purchases`).
   - Paywall screen (`apps/mobile/src/features/subscription/PaywallScreen.tsx`) displays:
     - Clear subscription terms, duration (Monthly: \$4.99 / ₹399, Annual: \$39.99 / ₹2,999 with 33% discount).
     - Explicit disclosure that payment will be charged to Apple ID account at confirmation of purchase.
     - Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
     - Direct links to **Terms of Service** and **Privacy Policy**.
     - Functional "Restore Purchases" button calling `Purchases.restorePurchases()`.
3. **Guideline 2.1 — App Review Information & Demo Account:**
   - **Reviewer Demo Account:** `appreview@calmeter.test`
   - **Reviewer Note:**
     > "CAL METER includes demo mock fallbacks for all camera, scanning, and payment features. To test the food scanner without live camera hardware on a simulator, tap the Demo Image button on the Scan Screen. To test in-app purchases, use the sandbox App Store testing environment or tap Restore Purchases."

---

## 4. Production Infrastructure Audit & Operational Runbook

### 4.1. Architecture Topology

```mermaid
flowchart TD
    Mobile["📱 Mobile App (iOS / Android)"] -->|HTTPS / TLS 1.3| ALB["Cloud Load Balancer / Ingress"]
    Admin["💻 Web Admin Panel (SPA)"] -->|HTTPS / TLS 1.3| ALB

    ALB -->|/api/v1/*| API1["Express API Instance 1"]
    ALB -->|/api/v1/*| API2["Express API Instance 2"]

    API1 -->|Prisma Pool| PG[("🐘 PostgreSQL 16 Managed DB\n(Primary + Read Replica)")]
    API2 -->|Prisma Pool| PG

    API1 -->|Enqueues Jobs| Redis[("⚡ Redis 7 Cluster\n(BullMQ Queues + Rate Limits)")]
    API2 -->|Enqueues Jobs| Redis

    Worker1["⚙️ BullMQ Worker Instance 1"] -->|Pulls Jobs| Redis
    Worker2["⚙️ BullMQ Worker Instance 2"] -->|Pulls Jobs| Redis

    Worker1 -->|DB Updates| PG
    Worker2 -->|Push Notifications| FCM["Firebase Cloud Messaging / APNs"]
    Worker1 -->|AI Scan Inferences| Gemini["Google Gemini Vision API"]
```

### 4.2. Environment Variable Configuration Matrix

| Variable                        | Scope        | Production Setting                                                                        | Validation Rule                          |
| :------------------------------ | :----------- | :---------------------------------------------------------------------------------------- | :--------------------------------------- |
| `NODE_ENV`                      | API / Worker | `production`                                                                              | Enforces strict TLS, disables test stubs |
| `PORT`                          | API          | `4000` (or injected container port)                                                       | Integer 1-65535                          |
| `DATABASE_URL`                  | API          | `postgresql://<user>:<pwd>@<host>:5432/calmeter_prod?sslmode=require&connection_limit=20` | Non-empty PostgreSQL URI                 |
| `REDIS_URL`                     | API / Worker | `rediss://<user>:<pwd>@<host>:6379`                                                       | Non-empty Redis URI (TLS enabled)        |
| `CORS_ORIGIN`                   | API          | `https://admin.calmeter.com,https://calmeter.com`                                         | Comma-separated allowed web origins      |
| `FIREBASE_PROJECT_ID`           | API / Worker | `calmeter-prod`                                                                           | Valid GCP project ID                     |
| `FIREBASE_CREDENTIAL_MODE`      | API / Worker | `service-account`                                                                         | Mandatory in production                  |
| `FIREBASE_CLIENT_EMAIL`         | API / Worker | `api-sa@calmeter-prod.iam.gserviceaccount.com`                                            | Required when mode is service-account    |
| `FIREBASE_PRIVATE_KEY`          | API / Worker | `-----BEGIN PRIVATE KEY-----\n...`                                                        | Multi-line PEM private key               |
| `REVENUECAT_WEBHOOK_AUTH_TOKEN` | API          | Production shared secret                                                                  | Validates `POST /webhooks/revenuecat`    |
| `GEMINI_API_KEY`                | API / Worker | Encrypted GCP secret                                                                      | Required for Vision and AI Coach         |

### 4.3. Database Zero-Downtime Migration Strategy

1. All database migrations must be applied using:
   ```bash
   npm run prisma:migrate:deploy
   ```
2. Migrations must follow the **Expand / Contract** pattern:
   - _Phase 1 (Expand):_ Add new nullable columns or tables. Deploy new application code that writes to both old and new columns.
   - _Phase 2 (Backfill):_ Run idempotent migration scripts in background workers.
   - _Phase 3 (Contract):_ Remove old columns only after all instances run the updated code.
3. PostgreSQL connection pooling: Prisma Client is configured with connection pooling (`connection_limit=20` per pod, max 80 across 4 pods) leaving headroom for migrations and admin tools.

### 4.4. Backup, Point-In-Time-Recovery (PITR) & Restore Runbook

- **Automated Daily Backups:** Executed via cloud provider managed snapshot at 02:00 UTC daily (30-day retention).
- **Continuous Write-Ahead Log (WAL) Archiving:** Archived to secure cloud bucket every 5 minutes enabling Point-In-Time-Recovery down to the minute.
- **Manual Cold Backup Command:**
  ```bash
  pg_dump -h $PG_HOST -U $PG_USER -d calmeter_prod -Fc -f calmeter_backup_$(date +%Y%m%d_%H%M%S).dump
  ```
- **Restore Verification Procedure:**
  1. Restore backup into isolated verification database `calmeter_restore_test`.
  2. Run `npm test` against the restored database.
  3. Verify checksum of `food_items` and `users` tables.
  4. Destroy temporary restore test container.

### 4.5. Observability, Alerting & Health Probes

1. **Liveness Probe (`GET /health`):**
   - Returns `200 OK` with uptime. Checks process health.
2. **Readiness Probe (`GET /ready`):**
   - Actively checks PostgreSQL connection (`SELECT 1`) and Redis connection (`PING`).
   - If either fails, returns `503 Service Unavailable` with structured diagnostic payload.
3. **Prometheus Metrics Probe (`GET /metrics`):**
   - Emits OpenMetrics / Prometheus formatted telemetry:
     - `calmeter_api_http_requests_total`
     - `calmeter_api_http_request_duration_seconds`
     - `calmeter_api_http_errors_total`
     - `calmeter_api_active_users`
     - `calmeter_api_worker_active_jobs`
4. **Alerting Thresholds:**
   - **P1 Alert:** API 5xx error rate > 1.0% for 5 consecutive minutes.
   - **P1 Alert:** Database connection pool utilization > 85% for 3 minutes.
   - **P2 Alert:** Redis queue backlog > 1,000 pending scan/notification jobs.
   - **P2 Alert:** AI scan processing latency p95 > 8.0 seconds.

### 4.6. Graceful Degradation & Resilience

1. **AI Provider Outage (Gemini 5xx / Rate Limited):**
   - The system falls back automatically: if AI vision recognition fails, users are prompted to search the verified food database or enter food names manually. The food diary is never blocked.
2. **Redis Outage:**
   - In-memory rate limiting automatically engages if Redis is unreachable. Background notification jobs queue locally or defer gracefully without crashing HTTP request handlers.
3. **Out-of-Order Webhook Events:**
   - RevenueCat webhook handler inspects `existingSubscription.lastEventTimestamp`. Stale or out-of-order events are recorded as `IGNORED_OUT_OF_ORDER` to prevent race condition entitlement downgrades.

---

## 5. Pre-Release Defect Register & Resolution Log

| Issue ID   | Severity      | Description                                                                                 | Resolution Applied                                                                                                                                          | Verification                                         |
| :--------- | :------------ | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| **DEF-01** | **P1 (High)** | Missing in-app account deletion flow required by App Store 5.1.1(v) & GDPR/DPDP.            | Implemented `deleteAccount` in `ProfileService`, added `DELETE /api/v1/profile`, added "Delete Account" UI button with confirmation in `ProfileScreen.tsx`. | 20/20 API tests & 81/81 mobile tests passing.        |
| **DEF-02** | **P2 (Med)**  | Missing `POST_NOTIFICATIONS` permission in Android Manifest for Android 13+ devices.        | Added `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />` in `apps/mobile/android/app/src/main/AndroidManifest.xml`.                 | Manifest validated.                                  |
| **DEF-03** | **P2 (Med)**  | Missing `calmeter://` deep link intent-filter in Android Manifest.                          | Added intent-filter for scheme `calmeter` in `MainActivity`.                                                                                                | Deep links route to diary, progress, coach, paywall. |
| **DEF-04** | **P2 (Med)**  | Empty `NSLocationWhenInUseUsageDescription` in iOS `Info.plist` (App Store rejection risk). | Removed empty location key; added `NSPhotoLibraryUsageDescription` and `CFBundleURLTypes` for `calmeter`.                                                   | `Info.plist` validated.                              |
| **DEF-05** | **P2 (Med)**  | Missing ProGuard/R8 keep rules for React Native & Hermes in release builds.                 | Added standard keep rules for React Native, Hermes bytecode, and native JNI bindings in `apps/mobile/android/app/proguard-rules.pro`.                       | ProGuard rules validated.                            |
| **DEF-06** | **P3 (Low)**  | Duplicate `NotificationCampaignStatus` enum declaration in `packages/shared`.               | Cleaned duplicate declaration in `enums.ts`.                                                                                                                | `@calmeter/shared` 195/195 tests passing.            |

---

## 6. Pre-Launch Authorization Checklist

Before declaring public general availability:

- [x] All 709 automated unit, integration, contract, and component tests pass.
- [x] Zero unresolved P0 issues exist.
- [x] Zero unresolved P1 issues exist.
- [x] Nutrition calculations audited for deterministic Mifflin-St Jeor compliance.
- [x] In-app account deletion fully operational for GDPR / DPDP / Apple compliance.
- [x] App Store Privacy Manifest (`PrivacyInfo.xcprivacy`) configured.
- [x] Store metadata, descriptions, keywords, and screenshots prepared.
- [x] Production deployment, backup, and rollback runbooks documented.
- [ ] **Pending Store Submission Credentials:** Production Google Play upload keystore (`upload-keystore.jks`) and Apple Developer Team signing certificate to be attached in CI/CD release secrets.
- [ ] **Explicit Launch Authorization:** Awaiting user code review and final sign-off.
