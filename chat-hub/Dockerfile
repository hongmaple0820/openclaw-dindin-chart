# Chat-Hub Dockerfile
# Multi-stage build aligned with the TypeScript runtime entrypoint.

FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init wget

RUN addgroup -g 1001 -S chatuser && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G chatuser -g chatuser chatuser

COPY --from=builder --chown=chatuser:chatuser /app/node_modules ./node_modules
COPY --from=builder --chown=chatuser:chatuser /app/dist ./dist
COPY --from=builder --chown=chatuser:chatuser /app/migrations ./migrations
COPY --from=builder --chown=chatuser:chatuser /app/config ./config
COPY --from=builder --chown=chatuser:chatuser /app/data ./data
COPY --from=builder --chown=chatuser:chatuser /app/package*.json ./

RUN mkdir -p /data && chown -R chatuser:chatuser /data

ENV NODE_ENV=production \
    PORT=8273 \
    DATA_DIR=/data

USER chatuser

EXPOSE 8273

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8273/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
