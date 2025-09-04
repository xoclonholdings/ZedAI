#!/bin/bash

# Function to cleanup background processes on exit
cleanup() {
    echo "Shutting down services..."
    if [ -f ".pid_frontend" ]; then
        kill -15 $(cat .pid_frontend) 2>/dev/null
        rm .pid_frontend
    fi
    if [ -f ".pid_backend" ]; then
        kill -15 $(cat .pid_backend) 2>/dev/null
        rm .pid_backend
    fi
    exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

echo "🚀 Starting ZedAI Development Environment..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Start backend server
echo "📡 Starting backend server..."
cd server
NODE_ENV=development npm start & echo $! > ../.pid_backend
cd ..

# Wait for backend to be ready
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Start frontend development server
echo "🌐 Starting frontend development server..."
cd client
NODE_ENV=development VITE_API_URL=http://localhost:8080/api npm run dev & echo $! > ../.pid_frontend
cd ..

# Keep script running and show logs
echo "✨ Development environment is ready!"
echo "Press Ctrl+C to stop all services"

# Wait for either process to exit and cleanup
wait -n
cleanup
