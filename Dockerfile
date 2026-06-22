# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Production deps ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Runtime base (shared by all service roles) ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# SERVICE_ROLE (monolith|api|catalog|identity|commerce|payments) HTTP serve eder.
EXPOSE 3000
CMD ["node", "dist/app/server.js"]

# --- Notification worker (HTTP serve etmez) ---
FROM runtime AS notification-worker
ENV SERVICE_ROLE=notification-worker
CMD ["node", "dist/app/notification-worker.js"]

# --- Payments worker (reconciliation/retry scheduler'ları) ---
FROM runtime AS payments-worker
ENV SERVICE_ROLE=payments-worker
CMD ["node", "dist/app/server.js"]

# --- Gateway (Strangler-Fig reverse proxy, sadece public key ile RS256 verify) ---
FROM runtime AS gateway
ENV GATEWAY_PORT=8080
EXPOSE 8080
CMD ["node", "dist/app/gateway-server.js"]
