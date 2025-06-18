FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./

# Upgrade npm *BEFORE* installing dependencies. This is crucial.
RUN npm install -g npm@11.4.2

# Install ALL dependencies (including devDependencies) needed for build
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build arguments for Next.js public environment variables (matching docker-compose.yml)
ARG NODE_ENV=production
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_DEBUG=false
# Add a build timestamp to invalidate cache on every build
ARG BUILD_TIMESTAMP=default

# Create a file with the timestamp to bust cache
RUN echo "Build timestamp: $BUILD_TIMESTAMP" > build_timestamp.txt

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_DEBUG=${NEXT_PUBLIC_DEBUG}

# Increase memory limit for Node.js
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Install the correct npm version globally in this stage as well
RUN npm install -g npm@11.4.2

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install wget for health checks (as used in docker-compose.yml)
RUN apk add --no-cache wget

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies
RUN npm install -g npm@11.4.2
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create .next directory and set permissions
RUN chown nextjs:nodejs .next

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
