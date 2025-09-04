#!/bin/bash

# Test lambdasAnonymous Lambda locally with SAM CLI
set -e

echo "🧪 Testing lambdasAnonymous Lambda locally..."

# Load environment variables from local.env if it exists
if [ -f "deployment/lambdasAnonymous-deploy/local.env" ]; then
    echo "📁 Loading environment from local.env..."
    export $(cat deployment/lambdasAnonymous-deploy/local.env | grep -v '^#' | xargs)
fi

# Check if Lumigo token is provided or use from environment
if [ -z "$1" ] && [ -z "$LUMIGO_TRACER_TOKEN" ]; then
    echo "❌ Error: Please provide Lumigo token as first argument or set LUMIGO_TRACER_TOKEN in local.env"
    echo "Usage: ./scripts/test-lambda-local.sh <LUMIGO_TOKEN>"
    echo "Or run: ./scripts/setup-local-env.sh first"
    exit 1
fi

# Use provided token or environment variable
LUMIGO_TOKEN=${1:-$LUMIGO_TRACER_TOKEN}

# Navigate to deployment directory
cd deployment/lambdasAnonymous-deploy

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build
echo "📦 Building Lambda package..."
sam build

# Create test event if it doesn't exist
if [ ! -f "test-event.json" ]; then
    echo "📝 Creating test event file..."
    cat > test-event.json << EOF
{
  "httpMethod": "POST",
  "path": "/process",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"message\":\"Hello from Lambda\",\"data\":{\"userId\":\"12345\",\"email\":\"test@example.com\",\"password\":\"secret123\"}}",
  "queryStringParameters": {
    "param1": "value1"
  }
}
EOF
fi

# Test locally
echo "🧪 Invoking Lambda locally..."
sam local invoke lambdasAnonymousFunction \
    --event test-event.json \
    --env-vars <(echo "LUMIGO_TRACER_TOKEN=$LUMIGO_TOKEN")

echo "✅ Local test completed!"
