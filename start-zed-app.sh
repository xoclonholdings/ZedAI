#!/bin/bash
# Startup script for ZED full stack app (frontend + backend)

# Start backend server (port 5001)
echo "Starting ZED backend on port 5001..."
npx tsx server/index.ts &
BACKEND_PID=$!
sleep 2

# Start frontend dev server (port 5173)
echo "Starting ZED frontend on port 5173..."
cd client
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for both processes to exit
wait $BACKEND_PID
wait $FRONTEND_PID
