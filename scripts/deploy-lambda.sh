#!/bin/bash

# Deploy lambdasAnonymous Lambda with Lumigo tracing
set -e

echo "🚀 Deploying lambdasAnonymous Lambda..."

# Load environment variables from local.env if it exists
if [ -f "deployment/lambdasAnonymous-deploy/local.env" ]; then
    echo "📁 Loading environment from local.env..."
    export $(cat deployment/lambdasAnonymous-deploy/local.env | grep -v '^#' | xargs)
fi

# Check if Lumigo token is provided or use from environment
if [ -z "$1" ] && [ -z "$LUMIGO_TRACER_TOKEN" ]; then
    echo "❌ Error: Please provide Lumigo token as first argument or set LUMIGO_TRACER_TOKEN in local.env"
    echo "Usage: ./scripts/deploy-lambda.sh <LUMIGO_TOKEN>"
    echo "Or run: ./scripts/setup-local-env.sh first"
    exit 1
fi

# Use provided token or environment variable
LUMIGO_TOKEN=${1:-$LUMIGO_TRACER_TOKEN}

echo "🔑 Using Lumigo token: $LUMIGO_TOKEN"

# Build the lumigo-tracer first
echo "📦 Building lumigo-tracer..."
npm run build

# Copy built files to deployment directory
echo "📦 Copying built files to deployment directory..."
cp -r src/lumigo-tracer/dist deployment/lambdasAnonymous-deploy/lumigo-node/

# Navigate to deployment directory
cd deployment/lambdasAnonymous-deploy

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build Lambda package
echo "📦 Building Lambda package..."
sam build

# Deploy to AWS
echo "🚀 Deploying to AWS..."
echo "🔑 Deploying with Lumigo token: $LUMIGO_TOKEN"

# Deploy with non-interactive flags
sam deploy \
    --no-confirm-changeset \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides "LumigoToken=$LUMIGO_TOKEN" \
    --stack-name lambdasAnonymous-stack \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ lambdasAnonymous Lambda deployed successfully!"
    echo "🔍 Check AWS Console for the new function: lambdasAnonymous"
    echo "🌐 API Gateway endpoint: https://jqms16v249.execute-api.us-east-1.amazonaws.com/Prod/process"
else
    echo "❌ Deployment failed!"
    exit 1
fi
