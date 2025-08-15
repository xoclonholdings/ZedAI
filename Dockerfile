


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

	FROM node:22.17.0 AS builder

	# Build frontend
	WORKDIR /app/zed-web
	COPY zed-web/package.json zed-web/package-lock.json ./
	RUN --mount=type=cache,id=zed-web-node-modules,target=/app/zed-web/node_modules \
		npm ci || npm install
	COPY zed-web/ ./
	RUN --mount=type=cache,id=zed-web-node-modules,target=/app/zed-web/node_modules \
		npm run build

	# Build backend
	WORKDIR /app/backend
	COPY backend/package.json ./
	# Try to copy lockfile if present, fallback gracefully
	RUN [ -f /app/backend/package-lock.json ] && cp /app/backend/package-lock.json . || true
	# Resilient install: retry up to 3 times, fallback to npm install if lockfile missing
	RUN tries=0; until [ $tries -ge 3 ] || npm ci; do tries=$((tries+1)); sleep 2; done || \
		tries=0; until [ $tries -ge 3 ] || npm install; do tries=$((tries+1)); sleep 2; done

	COPY backend/ ./

	# Stage 2: Caddy server
	FROM caddy:2.7.6-alpine
	WORKDIR /srv

	# Copy frontend build
	COPY --from=builder /app/zed-web/dist ./frontend

	# Copy backend public files
	COPY --from=builder /app/backend/public ./backend

	# Add Caddyfile
	COPY Caddyfile /etc/caddy/Caddyfile

	EXPOSE 80
