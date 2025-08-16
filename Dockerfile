# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY client ./client
WORKDIR /app/client
RUN npm install || npm install --force && npm run build

# ---- Backend Stage ----
FROM node:22-alpine AS backend
WORKDIR /app
COPY server ./server
WORKDIR /app/server
RUN [ -f package-lock.json ] && npm ci || npm install && npm run build

# ---- Final Stage ----
FROM caddy:2-alpine
WORKDIR /srv
COPY --from=builder /app/client/dist ./client
COPY --from=backend /app/server/dist ./server/dist
COPY --from=backend /app/server/package.json ./server/package.json
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
