
# Stage 1: Build frontend
FROM node:22.17.0 AS frontend-builder
WORKDIR /app/zed-web
COPY zed-web/package.json zed-web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
	npm ci || npm install
COPY zed-web ./
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:22.17.0 AS backend-builder
WORKDIR /app/backend
COPY backend/package.json ./
# Copy lockfile only if present
COPY backend/package-lock.json ./ || true
RUN --mount=type=cache,target=/root/.npm \
	npm ci || npm install || echo "Lockfile missing, installed without it"
COPY backend ./

# Stage 3: Final image with Caddy
FROM caddy:2.7.6-alpine
WORKDIR /srv
COPY --from=frontend-builder /app/zed-web/dist ./frontend
COPY --from=backend-builder /app/backend/public ./backend-public
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
