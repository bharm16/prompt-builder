#!/bin/bash

# Start the backend server
echo "🚀 Starting backend server..."
node server.js &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Start the frontend
echo "🎨 Starting frontend..."
npm run dev &
VITE_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down..."
    kill $SERVER_PID $VITE_PID 2>/dev/null
    exit
}

# Set up trap for cleanup on exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
