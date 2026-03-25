#!/bin/bash

echo "🧠 ZED AI Backend Brain - Development Server"
echo "============================================="

# Check if Ollama is running
if curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo "✅ Ollama is running"
else
    echo "⚠️  Ollama not detected on localhost:11434"
    echo "   Run: ollama serve"
    echo "   Then: ollama pull llama2"
fi

# Start the backend server
echo "🚀 Starting ZED Backend Brain..."
cd server && npm run dev
