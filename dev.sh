#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting ZedAI Development Environment...${NC}"

# Function to check if a port is available
check_port() {
    nc -z localhost $1 2>/dev/null
    if [ $? -eq 0 ]; then
        return 1
    else
        return 0
    fi
}

# Find available ports
find_available_port() {
    local port=$1
    while ! check_port $port; do
        port=$((port + 1))
    done
    echo $port
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    echo -e "${BLUE}Waiting for $name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null; then
            echo -e "${GREEN}✅ $name is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Timeout waiting for $name${NC}"
    return 1
}

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "node|vite" >/dev/null 2>&1

# Find available ports
BACKEND_PORT=$(find_available_port 5000)
FRONTEND_PORT=$(find_available_port $((BACKEND_PORT + 1)))

echo -e "${BLUE}Using ports:${NC}"
echo "Backend: $BACKEND_PORT"
echo "Frontend: $FRONTEND_PORT"

# Export ports for child processes
export PORT=$BACKEND_PORT
export VITE_PORT=$FRONTEND_PORT

# Start backend
echo -e "${BLUE}Starting backend server...${NC}"
cd server
NODE_ENV=development PORT=$BACKEND_PORT npm start &
BACKEND_PID=$!

# Wait for backend to be ready
wait_for_service "http://localhost:$BACKEND_PORT/health" "Backend"

# Start frontend
echo -e "${BLUE}Starting frontend development server...${NC}"
cd ../client
VITE_API_URL="http://localhost:$BACKEND_PORT" PORT=$FRONTEND_PORT npm run dev &
FRONTEND_PID=$!

# Wait for frontend to be ready
wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend"

# If both services are running, show success message
if ps -p $BACKEND_PID > /dev/null && ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✨ ZedAI Development Environment is ready!${NC}"
    echo -e "${BLUE}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo -e "${BLUE}Backend:${NC} http://localhost:$BACKEND_PORT"
    echo -e "${BLUE}API:${NC} http://localhost:$BACKEND_PORT/api"
    echo -e "\nPress Ctrl+C to stop all services"
    
    # Wait for user interrupt
    wait
else
    echo -e "${RED}❌ Failed to start all services${NC}"
    exit 1
fi
