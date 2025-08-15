# Railway-ready Dockerfile for ZedAI (Node 22.x)
FROM node:22.17.0 AS builder

WORKDIR /app

# Install frontend dependencies and build
COPY zed-web/package.json zed-web/package-lock.json ./zed-web/
RUN cd zed-web && npm ci && npm run build

# Install backend dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# Copy backend and built frontend
COPY backend ./backend
COPY zed-web/dist ./backend/public

# Use Caddy for static file serving and CSP headers
FROM caddy:2.7.6-alpine
WORKDIR /app
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/backend/public /app/backend/public
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 5001 80
CMD caddy run --config /etc/caddy/Caddyfile & node /app/backend/server.js
