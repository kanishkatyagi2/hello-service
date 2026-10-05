# Build stage: install deps
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Runtime stage: minimal final image
FROM node:20-alpine
WORKDIR /app

# Run as non-root — security practice we'll lean on again in Phase 11 (RBAC/security)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY package.json index.js ./
USER appuser

EXPOSE 3000
CMD ["node", "index.js"]