# --- BUILD STAGE ---
FROM node:20-alpine AS builder

WORKDIR /app/server

# Copy all files from local ./server directory
COPY ./server/ .

# Install dependencies (show errors clearly)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build TypeScript (show errors clearly)
RUN npm run build

# --- RUNTIME STAGE ---
FROM node:20-alpine AS runtime

WORKDIR /app/server

# Copy only what's needed to run the app
COPY --from=builder /app/server/package.json ./
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist

# Start the app
CMD ["node", "dist/index.js"]
