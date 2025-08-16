# ---- Build Frontend ----
FROM node:22-alpine AS builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
COPY client/ .
RUN npm run build --force

# ---- Build Backend ----

# ---- Final Stage ----
FROM caddy:2.8.3-alpine AS web
WORKDIR /srv
COPY --from=builder /app/client/dist ./client
COPY --from=backend /app/server ./server
COPY --from=backend /app/server/package.json ./server/package.json

# Expose ports (dynamic for Railway)
EXPOSE 80
EXPOSE 443

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
COPY client ./client
WORKDIR /app/client
RUN npm install || npm install --force && npm run build

# ---- Backend Stage ----
FROM node:22-alpine AS backend
WORKDIR /app
COPY server ./server
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi && npm run build

# ---- Final Stage ----
FROM caddy:2-alpine
WORKDIR /srv
COPY --from=builder /app/client/dist ./client
COPY --from=backend /app/server/dist ./server/dist
COPY --from=backend /app/server/package.json ./server/package.json
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
