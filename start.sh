#!/bin/bash

# Build the frontend
echo "Building frontend..."
cd client
npm run build

# Start the backend server
echo "Starting backend server..."
cd ../server
npm start
