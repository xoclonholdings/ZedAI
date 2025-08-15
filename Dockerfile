


# Frontend build stage
FROM node:22.17.0 AS builder
WORKDIR /app/zed-web

# Copy package files first for better cache
COPY zed-web/package.json zed-web/package-lock.json ./

# Install dependencies with Railway cache mount
RUN --mount=type=cache,id=zed-web-node-modules,target=/app/zed-web/node_modules \
	npm ci || npm install

# Copy source and build
COPY zed-web/ ./
RUN --mount=type=cache,id=zed-web-node-modules,target=/app/zed-web/node_modules \
	npm run build

# Backend stage
FROM node:22.17.0 AS backend
WORKDIR /app/backend


# Copy package file(s)
COPY backend/package.json ./
# Copy lockfile if present
RUN if [ -f backend/package-lock.json ]; then cp backend/package-lock.json ./; fi

# Install dependencies, retry if network fails, fallback if lockfile missing
RUN (npm ci || npm install || (echo 'Retrying npm install...' && sleep 5 && npm install)) || echo "Lockfile missing, installed without it"

# Copy backend source
COPY backend/ ./

# Final Caddy stage
FROM caddy:2.7.6-alpine AS final
WORKDIR /srv

# Copy frontend build
COPY --from=builder /app/zed-web/dist ./frontend

# Copy backend public files
COPY --from=backend /app/backend/public ./backend

# Add Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
