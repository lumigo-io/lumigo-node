#!/bin/bash

# Test EventProcessor Lambda locally with SAM CLI
set -e

echo "🧪 Testing EventProcessor Lambda locally..."

# Load environment variables from local.env if it exists
if [ -f "deployment/eventProcessor-deploy/local.env" ]; then
    echo "📁 Loading environment from local.env..."
    export $(cat deployment/eventProcessor-deploy/local.env | grep -v '^#' | xargs)
fi

# Check if Lumigo token is provided or use from environment
if [ -z "$1" ] && [ -z "$LUMIGO_TRACER_TOKEN" ]; then
    echo "❌ Error: Please provide Lumigo token as first argument or set LUMIGO_TRACER_TOKEN in local.env"
    echo "Usage: ./test-eventProcessor-local.sh <LUMIGO_TOKEN>"
    echo "Or create local.env with LUMIGO_TRACER_TOKEN=your_token"
    exit 1
fi

# Use provided token or environment variable
LUMIGO_TOKEN=${1:-$LUMIGO_TRACER_TOKEN}

# Navigate to deployment directory
cd deployment/eventProcessor-deploy

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build
echo "📦 Building Lambda package..."
sam build

# Update env.json with actual token for local testing
echo "🔧 Updating environment variables..."
sed -i.bak "s/PLACEHOLDER_TOKEN/$LUMIGO_TOKEN/g" env.json

# Test locally
echo "🧪 Invoking Lambda locally..."
sam local invoke EventProcessorFunction \
    --event ../../test-eventProcessor-payload.json \
    --env-vars env.json

# Restore original env.json
echo "🧹 Cleaning up environment file..."
mv env.json.bak env.json

echo "✅ Local test completed!"
