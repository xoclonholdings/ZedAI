#!/usr/bin/env bash
# Auto-launch ZedAI backend and frontend for local development

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Start backend
node --env-file=.env server/runZedBackend.js &
BACKEND_PID=$!
echo "ZedAI backend started with PID $BACKEND_PID"

# Start frontend
npm run dev --prefix client &
FRONTEND_PID=$!
echo "ZedAI frontend started with PID $FRONTEND_PID"

# Wait for both processes
wait $BACKEND_PID
wait $FRONTEND_PID
