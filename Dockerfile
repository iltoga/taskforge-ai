# syntax=docker.io/docker/dockerfile:1

# Stage 1: Base image with system dependencies (cached for weeks/months)
FROM node:24-alpine AS base

# Install system dependencies - this layer rarely changes so it's heavily cached
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    build-base \
    python3 \
    make \
    g++ \
    wget \
    imagemagick \
    ghostscript \
    netcat-openbsd

# Stage 2: Dependencies installation (cached until package files change)
FROM base AS deps
WORKDIR /app

# Copy only package files first for optimal layer caching
COPY package.json package-lock.json* ./

# Use BuildKit cache mount for npm cache - saves 60-80% of build time
RUN --mount=type=cache,target=/root/.npm \
    npm install -g npm@11.4.2

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production && npm cache clean --force

# Install ALL dependencies (including dev) in a separate layer for builder
FROM base AS deps-full
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies) with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install -g npm@11.4.2

RUN --mount=type=cache,target=/root/.npm \
    npm ci && npm cache clean --force

# Rebuild sharp for Linux platform with cache
RUN --mount=type=cache,target=/root/.npm \
    npm rebuild sharp --platform=linux --arch=x64

# Stage 3: Build stage (only rebuilds when source code changes)
FROM deps-full AS builder
WORKDIR /app

# Copy source code and config files
COPY . .
COPY public ./public
COPY prompts ./prompts
COPY settings ./settings

# Accept build arguments
ARG NODE_ENV=production
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_DEBUG=false
ARG GIT_COMMIT_SHA=unknown
ARG OPENAI_API_KEY

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_DEBUG=${NEXT_PUBLIC_DEBUG}
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Build the application with Next.js cache mount
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Stage 4: Runtime image (smallest possible size)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Accept runtime environment variables
ARG OPENAI_API_KEY
ENV OPENAI_API_KEY=${OPENAI_API_KEY}

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package files for runtime
COPY package.json package-lock.json* ./

# Copy production dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy Prisma schema and generate client for runtime
COPY --chown=nextjs:nodejs prisma ./prisma
RUN npx prisma generate

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prompts ./prompts
COPY --from=builder --chown=nextjs:nodejs /app/settings ./settings

# Create directories and set permissions
RUN mkdir -p /app/tmp_data && chown nextjs:nodejs /app/tmp_data

# Copy and set up entrypoint
COPY .docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && chown nextjs:nodejs /usr/local/bin/entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
