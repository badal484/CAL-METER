# Multi-stage Dockerfile for CAL METER Production Background Worker
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy workspace package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/worker/package.json ./apps/worker/
COPY infrastructure/prisma ./infrastructure/prisma/

# Install dependencies across monorepo
RUN npm ci

# Copy monorepo source files
COPY packages/shared ./packages/shared
COPY packages/contracts ./packages/contracts
COPY apps/worker ./apps/worker

# Build dependencies, generate Prisma Client, and build Worker
RUN npm run build --workspace=@calmeter/shared
RUN npm run build --workspace=@calmeter/contracts
RUN npm run prisma:generate
RUN npm run build --workspace=@calmeter/worker

# -------------------------------------------------------------
# Production Runner Stage
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies (OpenSSL required for Prisma engine)
RUN apk add --no-cache openssl

# Run as non-root user
USER node

# Copy build artifacts and dependencies from builder stage
COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/packages/contracts ./packages/contracts
COPY --chown=node:node --from=builder /app/infrastructure/prisma ./infrastructure/prisma
COPY --chown=node:node --from=builder /app/apps/worker ./apps/worker

CMD ["node", "apps/worker/dist/worker.js"]
