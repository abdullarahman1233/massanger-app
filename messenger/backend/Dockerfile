# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build output and migrations
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Run migrations then start server
CMD ["sh", "-c", "node dist/migrations/run.js && node dist/migrations/seed.js; node dist/index.js"]
