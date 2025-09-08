#!/bin/bash

# Manual Build Script for Custom Lumigo Tracer with Anonymization
# Use this if the automated deploy.sh script fails

set -e

echo "🔧 Manual Build Process for Custom Lumigo Tracer"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "lumigo-node/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📦 Step 1: Building TypeScript..."
cd lumigo-node

# Build with TypeScript
echo "   Running TypeScript compilation..."
npm run build 2>/dev/null || npx tsc --build --force

echo "✅ TypeScript build completed"

echo "🔧 Step 2: Creating Babel configuration..."
# Create .babelrc file in the correct location
echo '{"presets": ["@babel/preset-env"], "plugins": ["@babel/plugin-proposal-decorators", {"decoratorsBeforeExport": true}]}' > src/lumigo-tracer/.babelrc

echo "✅ Babel configuration created"

echo "🔄 Step 3: Converting ES6 to CommonJS with Babel..."
# Convert ES6 modules to CommonJS
npx babel dist --out-dir dist --extensions .js --source-maps

echo "✅ Babel conversion completed"

echo "🔍 Step 4: Verifying custom code is included..."
# Check that anonymization code is present
if grep -q "LUMIGO_ANONYMIZE" dist/tracer/tracer.js; then
    echo "✅ Custom anonymization code found in built files"
else
    echo "❌ Error: Custom anonymization code not found in built files"
    exit 1
fi

# Check that no ES6 imports remain
if grep -q "import.*from" dist/tracer/tracer.js; then
    echo "❌ Error: ES6 imports still present in built files"
    exit 1
else
    echo "✅ No ES6 imports found - conversion successful"
fi

echo "📁 Step 5: Copying built files to deployment directory..."
cd ..

# Copy the built tracer
cp -r lumigo-node/dist/* deployment/lambdasAnonymous-deploy/lumigo-node/
cp lumigo-node/package.json deployment/lambdasAnonymous-deploy/lumigo-node/

echo "✅ Built files copied to deployment directory"

echo "📦 Step 6: Copying essential dependencies..."
# Create node_modules directory
mkdir -p deployment/lambdasAnonymous-deploy/lumigo-node/node_modules

# Copy essential dependencies
cp -r lumigo-node/node_modules/@lumigo deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/debug deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/ms deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/agentkeepalive deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/depd deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/aws-sdk deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/

echo "✅ Essential dependencies copied"

echo "🚀 Step 7: Building and deploying SAM application..."
cd deployment/lambdasAnonymous-deploy

# Build SAM application
sam build

# Deploy to AWS
sam deploy --no-confirm-changeset

echo "✅ SAM application deployed successfully"

echo ""
echo "🎉 Manual build process completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Test the deployed Lambda using the API Gateway URL"
echo "2. Check CloudWatch logs for anonymization messages"
echo "3. Verify spans are being sent to Lumigo"
echo ""
echo "🔍 Test command:"
echo "curl -X POST https://YOUR_API_GATEWAY_URL/Prod/process \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"type\": \"user_registration\", \"data\": {\"user\": {\"name\": \"John Smith\", \"email\": \"john.smith@example.com\", \"ssn\": \"123-45-6789\", \"phone\": \"(555) 123-4567\", \"address\": \"123 Main Street, Anytown, USA 12345\", \"credit_card\": \"4532 1234 5678 9012\", \"ip_address\": \"192.168.1.100\"}}}'"
