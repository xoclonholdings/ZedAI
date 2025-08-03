# ZED Frontend-Backend Connection Guide

## Architecture Overview
- **Frontend**: Runs on port `5173` (React + TypeScript + Vite + Tailwind)
- **Backend Simple Mode**: Port `3001` (chat, conversations, auth, files)
- **Backend Agent Mode**: Port `5001` (memory, analytics, zed-memory, agent)

## Quick Start

### 1. Backend Setup
```bash
# Navigate to your backend repository
cd /path/to/zed-backend

# Start simple mode backend (port 3001)
npm run dev:simple

# In another terminal, start agent mode backend (port 5001)
npm run dev:agent
```

### 2. Frontend Setup
```bash
# Navigate to this frontend directory
cd /home/xoclonholdings/Zebulon/Zed/frontend_design

# Install dependencies
npm install

# Start development server (port 5173)
npm run dev
```

## Environment Configuration

### Development (.env)
- Frontend: http://localhost:5173
- Simple Backend: http://localhost:3001
- Agent Backend: http://localhost:5001

### Production (.env.production)
- Update with your actual production domains
- Configure CORS on your backend for production

## API Routing Logic

The frontend automatically routes requests to the correct backend:

### Simple Mode Backend (Port 3001)
- `/api/chat`
- `/api/conversations` 
- `/api/messages`
- `/api/auth`
- `/api/files`

### Agent Mode Backend (Port 5001)
- `/api/agent`
- `/api/memory`
- `/api/zed-memory`
- `/api/analytics`

## Troubleshooting

1. **CORS Issues**: Ensure your backend allows requests from `http://localhost:5173`
2. **Port Conflicts**: Check no other services are using ports 3001, 5001, or 5173
3. **Environment Variables**: Verify `.env` file is loaded correctly

## Development Workflow

1. Start both backend services
2. Start frontend development server
3. Navigate to `http://localhost:5173`
4. The frontend will automatically proxy API requests to the correct backend

## Production Deployment

1. Update `.env.production` with production URLs
2. Build frontend: `npm run build`
3. Deploy built files to your hosting service
4. Ensure backend CORS allows your production domain
