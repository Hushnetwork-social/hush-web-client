# Hush Web Client Dockerfile
# Multi-stage build for production Next.js application

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY hush-web-client/package.json hush-web-client/package-lock.json ./

# Install dependencies
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Build arguments (injected at build time)
ARG APP_VERSION=Production
ARG NEXT_PUBLIC_GRPC_URL=https://api.hushnetwork.social
ARG NEXT_PUBLIC_DEBUG_LOGGING=false

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY hush-web-client/ ./

# Set environment variables for build
# NEXT_PUBLIC_* variables are baked into client-side JS at build time
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
ENV NEXT_PUBLIC_GRPC_URL=${NEXT_PUBLIC_GRPC_URL}
ENV NEXT_PUBLIC_DEBUG_LOGGING=${NEXT_PUBLIC_DEBUG_LOGGING}
ENV NEXT_TELEMETRY_DISABLED=1
ENV STANDALONE_BUILD=true

# Build the application
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
