# CAL METER — Technology Stack & Engineering Decisions

**Document Version:** 1.1.0  
**Status:** Approved Architecture Specification  
**Owner:** Principal Software Architect  
**Package Manager:** **npm only** (npm workspaces)  
**Last Updated:** November 2026

---

## 1. Stack Overview & Strategic Rationale

The CAL METER technology stack is selected based on five production pillars:

1. **Type Safety Across Boundaries:** End-to-end TypeScript spanning mobile apps, backend APIs, background workers, and shared validation contracts (`@calmeter/shared` and `@calmeter/contracts`).
2. **Deterministic Architecture:** Native camera pipelines, unverified design target API response times (< 150ms), and rapid multimodal food identification estimates.
3. **Data Integrity & Compliance:** Strict ACID relational guarantees for financial/subscription and health diary data, coupled with isolated tenant scopes.
4. **Developer Velocity & Maintainability:** Lean, industry-standard libraries that avoid premature abstraction while preventing vendor lock-in.
5. **No Expo Restriction:** Native React Native CLI configuration ensures absolute control over native iOS/Android camera drivers, MLKit frame processors, and native build optimizations.
6. **Package Manager Standardization:** **npm** is the exclusive package manager across all development, CI/CD, and production environments. Do not use pnpm or Yarn.

---

## 2. Mobile Client Stack (React Native CLI)

| Component                | Selected Technology              | Version / Target                      | Engineering Justification                                                                                                                                                 |
| :----------------------- | :------------------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package Manager**      | **npm**                          | 10.0+                                 | Official Node.js package manager; consistent lockfile across monorepo workspaces.                                                                                         |
| **Platform Framework**   | **React Native CLI**             | 0.76+ (New Architecture / Bridgeless) | Provides bare-metal native access to camera hardware, custom build configurations, and C++ TurboModules. Eliminates Expo managed workflow constraints.                    |
| **Language**             | **TypeScript**                   | 5.5+ (Strict Mode)                    | Prevents runtime null/undefined errors; enables direct import of shared Zod contracts and DTO types.                                                                      |
| **Navigation**           | **React Navigation**             | v7                                    | Industry standard for mobile React Native; supports native stack navigation (smooth 60/120fps transitions), deep links, and tab persistence.                              |
| **Client State**         | **Zustand**                      | 5.0+                                  | Lightweight (< 2KB), zero-boilerplate state store. Supports out-of-React state access (e.g. inside Axios interceptors) and seamless persistence with `react-native-mmkv`. |
| **Server State & Cache** | **TanStack Query (React Query)** | v5                                    | Robust asynchronous state management. Handles request deduplication, background caching, stale-while-revalidate, and offline persistence.                                 |
| **Form Handling**        | **React Hook Form**              | 7.50+                                 | Uncontrolled form inputs avoid unnecessary re-renders during high-frequency user typing in onboarding and custom food entry.                                              |
| **Schema Validation**    | **Zod**                          | 3.23+                                 | Declarative runtime validation shared identically between mobile client forms and backend API request bodies.                                                             |
| **Camera & Vision**      | **React Native Vision Camera**   | v4                                    | High-performance native camera abstraction with direct hardware capture control, photo compression, and frame processing.                                                 |
| **Barcode Detection**    | **MLKit Vision Camera Plugin**   | Current                               | On-device, hardware-accelerated barcode reader supporting UPC, EAN, and Code 128 formats with zero network overhead.                                                      |
| **Local Storage**        | **react-native-mmkv**            | v3                                    | Fast synchronous key-value store (written in C++) for caching settings and tokens.                                                                                        |
| **Image Compression**    | **react-native-image-resizer**   | Current                               | Compresses photos on-device to < 250 KB prior to network dispatch, saving mobile bandwidth and backend ingress latency.                                                   |

---

## 3. Backend API & Asynchronous Processing Stack

| Component               | Selected Technology | Version / Target   | Engineering Justification                                                                                                                                           |
| :---------------------- | :------------------ | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Runtime**             | **Node.js**         | 20.x or 22.x LTS   | High-throughput asynchronous event loop; universal JavaScript ecosystem allowing shared TypeScript packages.                                                        |
| **Web Framework**       | **Express.js**      | 4.x / 5.x          | Mature, battle-tested routing engine with minimal abstraction overhead and comprehensive middleware ecosystem.                                                      |
| **Language**            | **TypeScript**      | 5.5+ (Strict Mode) | Strict typing across controllers, services, database models, and external API wrappers.                                                                             |
| **Database**            | **PostgreSQL**      | 16+                | Enterprise-grade relational database. Offers ACID guarantees for food logging and subscription records, combined with native `JSONB` for flexible nutrient schemas. |
| **ORM / Query Builder** | **Prisma ORM**      | 5.x / 6.x          | Type-safe database client auto-generated from declarative schema; automated schema migrations; intuitive relation handling.                                         |
| **In-Memory Cache**     | **Redis**           | 7+                 | High-performance caching layer (L2) for user daily summaries, barcode lookups, and distributed token-bucket rate limiting.                                          |
| **Job Queue & Worker**  | **BullMQ**          | 5.x                | Distributed background task queue running on Redis. Provides concurrency management, job retry with exponential backoff, and delayed jobs.                          |
| **Logging**             | **Pino**            | 9.x                | Fast JSON structured logging with minimal CPU overhead. Integrates request correlation IDs (`x-request-id`).                                                        |
| **HTTP Security**       | **Helmet & CORS**   | Standard           | Enforces security headers (HSTS, CSP, X-Frame-Options) and strict origin verification.                                                                              |

---

## 4. Infrastructure & Third-Party Integrations

### 4.1. Firebase Authentication

- **Role:** Identity Provider (IdP).
- **Justification:** Manages multi-provider OAuth (Apple, Google), Phone SMS OTP, and token refresh lifecycles securely without storing passwords on our infrastructure.
- **Server Verification:** Backend uses `firebase-admin` to cryptographically verify RS256-signed JWTs on every authenticated route.

### 4.2. Multimodal AI Vision Provider Selection Process

- **Role:** Food identification, cooking method detection, and volumetric estimation.
- **Selection Process:** Instead of fixing an assumption of an older model (such as Gemini 1.5 Flash), CAL METER requires evaluating current production models against active official provider documentation (e.g. Gemini 1.5/2.x Flash, Claude 3.5 Sonnet, GPT-4o) prior to implementation.
- **Core Requirements:**
  - Fast multimodal inference time (design target < 1.5s).
  - Native JSON Mode / Structured Outputs.
  - Cost viability (< $0.002 per scan).
  - Pluggable interface (`IVisionProvider`) to prevent vendor lock-in.

### 4.3. Nutrition Datasets & Legal Compliance

- **USDA FoodData Central (FDC):** Public domain reference dataset for raw ingredients, whole foods, and standard staples.
- **Open Food Facts (OFF):** Global packaged food database. **ODbL License Compliance:** Open Food Facts is published under the Open Database License (ODbL). Any redistribution, derived database, or modification must provide appropriate attribution and comply with share-alike requirements.
- **Indian Food Composition Tables (IFCT / ICMR-NIN):** Comprehensive regional Indian nutritional data. **Licensing Verification Requirement:** Commercial licensing terms must be formally verified prior to ingesting or redistributing ICMR-NIN data in production.

### 4.4. Object Storage: S3-Compatible (Cloudflare R2 / AWS S3)

- **Role:** Storing user-uploaded food photos.
- **Justification:** Cloudflare R2 provides zero egress fees and S3 API compatibility. Private bucket configuration guarantees photos are inaccessible publicly and reachable only via signed URLs.

### 4.5. RevenueCat

- **Role:** In-App Purchase (IAP) infrastructure and subscription lifecycle management.
- **Justification:** Abstracts Apple App Store and Google Play Store billing edge cases (grace periods, retries, refunds). Server-side webhook validation ensures tamper-proof entitlement checks.

### 4.6. Sentry & PostHog

- **Sentry:** Production error tracking, breadcrumb tracing, and crash reporting with symbolication.
- **PostHog:** Privacy-first product analytics, event funnels, and feature flags without third-party ad tracking.
