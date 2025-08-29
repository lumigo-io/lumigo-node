#!/bin/bash

# Setup local environment for EventProcessor Lambda testing
set -e

echo "🔧 Setting up local environment for EventProcessor Lambda..."

# Check if .env file exists
if [ -f "deployment/eventProcessor-deploy/local.env" ]; then
    echo "📁 Found existing local.env file"
    echo "Current contents:"
    cat deployment/eventProcessor-deploy/local.env
    echo ""
    
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Updating local.env..."
    else
        echo "Keeping existing local.env"
        exit 0
    fi
fi

# Get Lumigo token
echo "🔑 Please enter your Lumigo token for local testing:"
read -s LUMIGO_TRACER_TOKEN
echo

# Get AWS region
echo "🌍 Please enter your AWS region (default: us-east-1):"
read AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

# Create/update local.env
cat > deployment/eventProcessor-deploy/local.env << EOF
# Local testing environment variables
LUMIGO_TRACER_TOKEN=$LUMIGO_TRACER_TOKEN
AWS_REGION=$AWS_REGION
NODE_ENV=development
EOF

echo "✅ Local environment configured successfully!"
echo "📁 Environment file: deployment/eventProcessor-deploy/local.env"
echo ""
echo "You can now run local tests with:"
echo "  ./deployment/test-eventProcessor-local.sh"
echo ""
echo "Or deploy to AWS with:"
echo "  ./deployment/deploy-eventProcessor.sh $LUMIGO_TRACER_TOKEN"
