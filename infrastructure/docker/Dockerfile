# Multi-stage build for production-ready Node.js application
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Download model assets during build (cached when inputs are unchanged)
COPY scripts/download-models.sh ./scripts/download-models.sh
ARG SPAN_LABELING_MODELS_GCS_URI
ENV SPAN_LABELING_MODELS_GCS_URI=${SPAN_LABELING_MODELS_GCS_URI}
RUN chmod +x ./scripts/download-models.sh && ./scripts/download-models.sh

# Copy application code
COPY . .

# Stage 2: Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies:
# - dumb-init: proper signal handling
# - ffmpeg: provides ffmpeg + ffprobe for continuity frame extraction
RUN apk add --no-cache dumb-init ffmpeg

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy built application from builder (includes downloaded model assets)
COPY --from=builder --chown=nodejs:nodejs /app ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application (tsx runs TypeScript directly)
CMD ["npx", "tsx", "--tsconfig", "server/tsconfig.json", "server/index.ts"]
