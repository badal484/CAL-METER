# Multi-stage Dockerfile for CAL METER Production API
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy workspace package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/
COPY infrastructure/prisma ./infrastructure/prisma/

# Install dependencies across monorepo
RUN npm ci

# Copy monorepo source files
COPY packages/shared ./packages/shared
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api

# Build dependencies, generate Prisma Client, and build API
RUN npm run build --workspace=@calmeter/shared
RUN npm run build --workspace=@calmeter/contracts
RUN npm run prisma:generate
RUN npm run build --workspace=@calmeter/api

# -------------------------------------------------------------
# Production Runner Stage
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install runtime dependencies (OpenSSL required for Prisma engine)
RUN apk add --no-cache openssl curl

# Create non-root system user
USER node

# Copy build artifacts and dependencies from builder stage
COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared ./packages/shared
COPY --chown=node:node --from=builder /app/packages/contracts ./packages/contracts
COPY --chown=node:node --from=builder /app/infrastructure/prisma ./infrastructure/prisma
COPY --chown=node:node --from=builder /app/apps/api ./apps/api

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]

