# CAL METER

> AI-powered calorie tracking and personal nutrition intelligence for Android and iOS. Built with React Native CLI, TypeScript, Node.js, PostgreSQL, Redis, and multimodal vision AI.

---

## Technical Documentation Index

All architectural, product, engineering, and security specifications are located in the [`docs/`](file:///Users/badal11/Desktop/CAL%20METER/docs) directory:

1. [**Product Requirements Document (PRD)**](file:///Users/badal11/Desktop/CAL%20METER/docs/PRODUCT_REQUIREMENTS.md) — Complete product vision, target personas, 22-feature scope, Indian & international food models, NFRs, and KPIs.
2. [**System Architecture**](file:///Users/badal11/Desktop/CAL%20METER/docs/SYSTEM_ARCHITECTURE.md) — Modular monolith topology, monorepo structure, end-to-end data flows, synchronous vs asynchronous isolation, Redis caching tiers, and observability.
3. [**Technology Stack & Decisions**](file:///Users/badal11/Desktop/CAL%20METER/docs/TECH_STACK.md) — Technology evaluation and architectural justifications across mobile, backend, databases, and third-party integrations.
4. [**Database Design & Schema**](file:///Users/badal11/Desktop/CAL%20METER/docs/DATABASE_DESIGN.md) — Complete PostgreSQL relational schema, Prisma models, compound indexes, trigram search, and constraints.
5. [**API Specification**](file:///Users/badal11/Desktop/CAL%20METER/docs/API_SPECIFICATION.md) — RESTful conventions, authentication headers, error codes, and endpoint contracts across all modules.
6. [**User Flows & Journeys**](file:///Users/badal11/Desktop/CAL%20METER/docs/USER_FLOWS.md) — Detailed interaction state machines, sequence diagrams, and fallback branches for onboarding, camera scanning, barcode lookup, and subscriptions.
7. [**Multimodal AI Vision Pipeline**](file:///Users/badal11/Desktop/CAL%20METER/docs/AI_PIPELINE.md) — Decoupled intelligence pattern, Gemini 1.5 Flash structured JSON prompt engineering, Indian food disambiguation heuristics, and deterministic nutrition matching.
8. [**Security, Privacy & Governance**](file:///Users/badal11/Desktop/CAL%20METER/docs/SECURITY_AND_PRIVACY.md) — Multi-tenant data isolation, GDPR / DPDP compliance, direct S3 upload security, account deletion (Apple 5.1.1(v)), and secret hygiene.
9. [**Testing Strategy & QA**](file:///Users/badal11/Desktop/CAL%20METER/docs/TESTING_STRATEGY.md) — Testing pyramid (Unit, Integration, E2E via Maestro), 100-image golden benchmark dataset, mobile device matrix, and CI quality gates.
10. [**Development Roadmap & Milestones**](file:///Users/badal11/Desktop/CAL%20METER/docs/DEVELOPMENT_ROADMAP.md) — 10 sequenced milestones, dependencies, and measurable acceptance criteria.

---

## High-Level Architecture

```
CAL-METER/
├── apps/
│   ├── mobile/                    # React Native CLI (iOS & Android)
│   ├── api/                       # Express.js REST API
│   └── worker/                    # BullMQ Asynchronous Task Worker
├── packages/
│   ├── contracts/                 # Shared Zod validation schemas & DTOs
│   └── shared/                    # Pure TypeScript nutrition math & constants
├── infrastructure/
│   ├── docker/                    # Docker Compose for local PostgreSQL & Redis
│   └── prisma/                    # Prisma database migrations & seeders
└── docs/                          # Comprehensive technical documentation
```
