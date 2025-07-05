FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files first for better caching
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
COPY public ./public
COPY prompts ./prompts
COPY settings ./settings

# Copy .env for build-time environment variables (e.g., OPENAI_API_KEY)
COPY .env .

# Accept build arguments for Next.js public environment variables
ARG NODE_ENV=production
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_DEBUG=false
# Git commit SHA for cache busting when code actually changes
ARG GIT_COMMIT_SHA=unknown

# Add build argument for OpenAI API key
ARG OPENAI_API_KEY

# Create a file with the git commit to bust cache only when code changes
RUN echo "Git commit: $GIT_COMMIT_SHA" > git_commit.txt

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_DEBUG=${NEXT_PUBLIC_DEBUG}

# Make OPENAI_API_KEY available at build time
ENV OPENAI_API_KEY=${OPENAI_API_KEY}

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

# Accept and set OPENAI_API_KEY in runner stage
ARG OPENAI_API_KEY
ENV OPENAI_API_KEY=${OPENAI_API_KEY}


# Install wget for health checks (as used in docker-compose.yml), ImageMagick and Ghostscript for PDF/image conversion
RUN apk add --no-cache wget imagemagick ghostscript

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package.json and package-lock.json (if available)
COPY package*.json ./
COPY .env ./

# Install production dependencies
RUN npm install -g npm@11.4.2
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prompts ./prompts

# Create .next directory and set permissions
RUN chown nextjs:nodejs .next

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
