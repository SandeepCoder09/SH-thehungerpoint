#!/bin/bash

# This script automatically kills any process using port 5000
# and starts the Razorpay backend server cleanly.

PORT=5000

echo "🔍 Checking if port $PORT is busy..."
PID=$(lsof -ti tcp:$PORT)

if [ ! -z "$PID" ]; then
  echo "⚠️ Port $PORT is in use by process $PID — killing it..."
  kill -9 $PID
  echo "✅ Port $PORT freed."
else
  echo "✅ Port $PORT is free."
fi

echo "🚀 Starting SH The Hunger Point backend..."
node razorpay-server.js
