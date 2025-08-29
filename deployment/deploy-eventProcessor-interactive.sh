#!/bin/bash

# Interactive deployment script for EventProcessor Lambda with Lumigo tracing
set -e

echo "🚀 Deploying EventProcessor Lambda with Interactive Token Setup..."
echo ""

# Load environment variables from local.env if it exists
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
fi

# Use provided token or environment variable
LUMIGO_TOKEN=${1:-$LUMIGO_TRACER_TOKEN}

# Check if we have a token
if [ -z "$LUMIGO_TOKEN" ]; then
    echo "❌ Error: No Lumigo token found"
    echo "Please provide Lumigo token as first argument or set LUMIGO_TRACER_TOKEN in local.env"
    echo "Usage: ./deployment/deploy-eventProcessor-interactive.sh <LUMIGO_TOKEN>"
    exit 1
fi

echo "🔑 Current Lumigo Token: $LUMIGO_TOKEN"
echo ""

# Ask user if they want to override the token
read -p "Do you want to use a different Lumigo token? (y/N): " -r OVERRIDE_TOKEN
echo

if [[ $OVERRIDE_TOKEN =~ ^[Yy]$ ]]; then
    echo "Please enter your new Lumigo token:"
    read -s NEW_TOKEN
    echo
    
    # Show the token for validation
    echo "🔑 New token entered: $NEW_TOKEN"
    echo ""
    
    # Ask for confirmation
    read -p "Is this token correct? (Y/n): " -r CONFIRM_TOKEN
    echo
    
    if [[ $CONFIRM_TOKEN =~ ^[Nn]$ ]]; then
        echo "❌ Token not confirmed. Exiting deployment."
        exit 1
    fi
    
    LUMIGO_TOKEN=$NEW_TOKEN
    echo "✅ Using new token: $LUMIGO_TOKEN"
else
    echo "✅ Using existing token: $LUMIGO_TOKEN"
fi

echo ""

# Show anonymization configuration
if [ ! -z "$LUMIGO_ANONYMIZE_ENABLED" ]; then
    echo "🔒 Anonymization enabled: $LUMIGO_ANONYMIZE_ENABLED"
fi

if [ ! -z "$LUMIGO_ANONYMIZE_REGEX" ]; then
    echo "🔒 Anonymization patterns: $LUMIGO_ANONYMIZE_REGEX"
fi

echo ""

# Navigate to deployment directory
cd deployment/eventProcessor-deploy

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build and package
echo "📦 Building Lambda package..."
sam build

# Deploy with the confirmed token
echo "🚀 Deploying to AWS with token: $LUMIGO_TOKEN"
echo ""

sam deploy --guided \
    --parameter-overrides "LumigoToken=$LUMIGO_TOKEN" \
    --capabilities CAPABILITY_IAM \
    --stack-name eventProcessor-stack

echo "✅ EventProcessor Lambda deployed successfully!"
echo "🔍 Check AWS Console for the new function: eventProcessor"
echo "🔑 Deployed with Lumigo token: $LUMIGO_TOKEN"
