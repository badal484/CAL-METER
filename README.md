# CAL METER

> AI-powered calorie tracking and personal nutrition intelligence for Android and iOS. Built with React Native CLI, TypeScript, Node.js, PostgreSQL, Redis, and multimodal vision AI.

---

## Monorepo Overview

This project is organized as an **npm workspaces monorepo**:

```text
cal-meter/
├── apps/
│   ├── mobile/         # React Native CLI client (iOS & Android)
│   ├── api/            # Express.js REST API
│   └── worker/         # BullMQ asynchronous processing worker
├── packages/
│   ├── shared/         # Pure TypeScript deterministic nutrition math, units & helpers
│   └── contracts/      # Runtime Zod validation schemas & API DTOs
├── docs/               # Comprehensive technical documentation
├── scripts/            # Monorepo maintenance & validation scripts
├── package.json        # Root npm workspaces configuration
├── package-lock.json   # Single root lockfile
├── tsconfig.base.json  # Shared TypeScript compiler configuration
├── .gitignore          # Repository ignore rules
├── .prettierrc         # Code style configuration
├── .prettierignore     # Prettier ignore rules
├── eslint.config.js    # Modern ESLint 9 flat configuration
└── README.md
```

---

## Package Manager & Scripts

This repository strictly uses **npm**. Do not use pnpm or Yarn.

```bash
# Install dependencies across all workspaces
npm install

# Build all workspace packages
npm run build

# Run unit and integration tests across workspaces
npm run test

# Typecheck all TypeScript code
npm run typecheck

# Lint codebase with ESLint
npm run lint

# Format code with Prettier
npm run format

# Verify formatting without modifying files
npm run format:check
```

---

## Technical Documentation Index

All architectural, product, engineering, and security specifications are located in the [`docs/`](docs/) directory:

1. [**Product Requirements Document (PRD)**](docs/PRODUCT_REQUIREMENTS.md) — Product vision, target personas, 22-feature matrix, Indian & international food modeling, health & safety rules, and NFRs.
2. [**System Architecture**](docs/SYSTEM_ARCHITECTURE.md) — Modular monolith topology, npm workspaces monorepo, asynchronous BullMQ workers, Redis L2 caching, and observability.
3. [**Technology Stack & Decisions**](docs/TECH_STACK.md) — Technology evaluation, npm standardization, AI provider selection process, and database licensing terms (ODbL / ICMR-NIN).
4. [**Database Design & Schema**](docs/DATABASE_DESIGN.md) — PostgreSQL schema, Prisma models, compound indexes, trigram search, and multi-tenant isolation.
5. [**API Specification**](docs/API_SPECIFICATION.md) — RESTful conventions, Bearer authentication, error code taxonomy, and endpoints across all domain modules.
6. [**User Flows & Journeys**](docs/USER_FLOWS.md) — State machines and sequence diagrams covering Onboarding, AI Photo Scanning, Barcode Scanner, and Subscriptions.
7. [**Multimodal AI Vision Pipeline**](docs/AI_PIPELINE.md) — Decoupled Intelligence Pattern, provider/model selection process, structured schema, transparent uncertainty, and deterministic nutrition matching.
8. [**Security, Privacy & Governance**](docs/SECURITY_AND_PRIVACY.md) — Multi-tenant data isolation, GDPR / DPDP compliance, presigned S3 uploads, Apple Guideline 5.1.1(v) account deletion, and secret management.
9. [**Testing Strategy & QA**](docs/TESTING_STRATEGY.md) — Testing pyramid (Unit, Integration, E2E via Maestro), 100-image golden benchmark dataset, and CI quality gates.
10. [**Development Roadmap & Milestones**](docs/DEVELOPMENT_ROADMAP.md) — 10 sequenced milestones, dependencies, and measurable acceptance criteria.
