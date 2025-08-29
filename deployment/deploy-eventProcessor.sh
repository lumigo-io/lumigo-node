#!/bin/bash

# Deploy EventProcessor Lambda with Lumigo tracing
set -e

echo "🚀 Deploying EventProcessor Lambda..."

# Load environment variables from local.env
if [ -f "deployment/eventProcessor-deploy/local.env" ]; then
    echo "📁 Loading environment from local.env..."
    
    # Load simple variables (not JSON arrays)
    export $(cat deployment/eventProcessor-deploy/local.env | grep -v '^#' | grep -v 'LUMIGO_ANONYMIZE_REGEX' | xargs)
    
    # Load JSON array separately
    if grep -q 'LUMIGO_ANONYMIZE_REGEX' deployment/eventProcessor-deploy/local.env; then
        LUMIGO_ANONYMIZE_REGEX=$(grep 'LUMIGO_ANONYMIZE_REGEX' deployment/eventProcessor-deploy/local.env | cut -d'=' -f2- | tr -d "'")
        echo "✅ Loaded environment variables from local.env"
    else
        echo "✅ Loaded environment variables from local.env"
    fi
else
    echo "❌ local.env file not found. Please run setup-local-env.sh first."
    exit 1
fi

# Display configuration
echo "🔑 Using Lumigo token: $LUMIGO_TRACER_TOKEN"
echo "🔒 Anonymization enabled: $LUMIGO_ANONYMIZE_ENABLED"
echo "🔒 Anonymization patterns: $LUMIGO_ANONYMIZE_REGEX"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build Lambda package
echo "📦 Building Lambda package..."
cd deployment/eventProcessor-deploy
sam build

# Deploy to AWS
echo "🚀 Deploying to AWS..."
echo "🔑 Deploying with Lumigo token: $LUMIGO_TRACER_TOKEN"
echo "💡 You can override this token during deployment if needed"

# Deploy with non-interactive flags
sam deploy \
    --no-confirm-changeset \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides "LumigoToken=$LUMIGO_TRACER_TOKEN" \
    --stack-name eventProcessor-stack \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ EventProcessor Lambda deployed successfully!"
    echo "🔍 Check AWS Console for the new function: eventProcessor"
else
    echo "❌ Deployment failed!"
    exit 1
fi
