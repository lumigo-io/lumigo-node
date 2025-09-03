#!/bin/bash

echo "🚀 Deploying Custom Lumigo Tracer with Anonymization..."

# Function to show usage
show_usage() {
    echo "Usage: $0 [lambda-name]"
    echo ""
    echo "Available Lambda functions:"
    echo "  eventProcessor    - Original event processing Lambda"
    echo "  lambdasAnonymous  - Example Lambda with manual tracing (recommended for users)"
    echo ""
    echo "If no lambda name is provided, you will be prompted to select one."
}

# Check if lambda name is provided as argument
if [ $# -eq 1 ]; then
    LAMBDA_NAME="$1"
    if [ "$LAMBDA_NAME" != "eventProcessor" ] && [ "$LAMBDA_NAME" != "lambdasAnonymous" ]; then
        echo "❌ Invalid Lambda name: $LAMBDA_NAME"
        show_usage
        exit 1
    fi
else
    echo "Available Lambda functions:"
    echo "1) eventProcessor    - Original event processing Lambda"
    echo "2) lambdasAnonymous  - Example Lambda with manual tracing (recommended for users)"
    echo ""
    read -p "Select Lambda function (1 or 2): " choice
    
    case $choice in
        1)
            LAMBDA_NAME="eventProcessor"
            ;;
        2)
            LAMBDA_NAME="lambdasAnonymous"
            ;;
        *)
            echo "❌ Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
fi

echo "Selected Lambda: $LAMBDA_NAME"
echo ""

# Configuration file (this is what you edit)
CONFIG_FILE="deployment-config.env"

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ $CONFIG_FILE not found. Creating default configuration..."
    cat > "$CONFIG_FILE" << 'EOF'
# Lumigo Configuration
LUMIGO_TRACER_TOKEN=t_f8f7b905da964eef89261
LUMIGO_ANONYMIZE_ENABLED=true

# Anonymization Patterns
LUMIGO_ANONYMIZE_REGEX=["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]

# Data Schema for Anonymization
LUMIGO_ANONYMIZE_DATA_SCHEMA=[
  {"field": "address", "type": "truncate", "maxChars": 20, "position": "end"},
  {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"},
  {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"},
  {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"},
  {"field": "ssn", "type": "pattern", "pattern": "(\\d{3})-(\\d{2})-\\d{4}", "replacement": "$1-$2-****"},
  {"field": "credit_card", "type": "pattern", "pattern": "(\\d{4})[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}", "replacement": "$1 **** **** ****"},
  {"field": "phone", "type": "pattern", "pattern": "\\((\\d{3})\\) (\\d{3})-\\d{4}", "replacement": "($1) $2-****"},
  {"field": "email", "type": "pattern", "pattern": "^([^@]{2})[^@]*@", "replacement": "$1***@"},
  {"field": "ip_address", "type": "pattern", "pattern": "(\\d{1,3}\\.\\d{1,3})\\.\\d{1,3}\\.\\d{1,3}", "replacement": "$1.***.***"}
]
EOF
    echo "✅ Created $CONFIG_FILE with default configuration"
    echo "💡 Edit this file to customize anonymization settings"
    echo ""
fi

# Source the configuration
echo "📝 Loading configuration from $CONFIG_FILE..."
source "$CONFIG_FILE"

echo "🔧 Current configuration:"
echo "  - Anonymization enabled: $LUMIGO_ANONYMIZE_ENABLED"
echo "  - Regex patterns: $LUMIGO_ANONYMIZE_REGEX"
echo "  - Data schema: $LUMIGO_ANONYMIZE_DATA_SCHEMA"
echo ""

# Clean up any existing deployment directory (but preserve source files)
echo "🧹 Cleaning up existing deployment directory..."
if [ "$LAMBDA_NAME" = "lambdasAnonymous" ]; then
# For lambdasAnonymous, preserve the source files and only clean the build artifacts
    rm -rf deployment/${LAMBDA_NAME}-deploy/lumigo-node
    rm -f deployment/${LAMBDA_NAME}-deploy/samconfig.toml
else
    # For eventProcessor, clean everything
    rm -rf deployment/${LAMBDA_NAME}-deploy
    mkdir -p deployment/${LAMBDA_NAME}-deploy
fi

# Create fresh deployment directory if it doesn't exist
echo "📁 Creating fresh deployment directory..."
mkdir -p deployment/${LAMBDA_NAME}-deploy

# Copy Lambda handler
echo "📋 Copying Lambda handler..."
if [ "$LAMBDA_NAME" = "lambdasAnonymous" ]; then
cp src/lambda-handlers/lambdasAnonymous.js deployment/${LAMBDA_NAME}-deploy/
else
    cp src/lambda-handlers/eventProcessor.js deployment/${LAMBDA_NAME}-deploy/
fi

# Create the handler file if it doesn't exist (fallback)
if [ ! -f "deployment/${LAMBDA_NAME}-deploy/${LAMBDA_NAME}.js" ] && [ ! -f "deployment/${LAMBDA_NAME}-deploy/eventProcessor.js" ]; then
    cat > deployment/${LAMBDA_NAME}-deploy/eventProcessor.js << 'EOF'
const lumigo = require('./lumigo-node');

// Initialize the modified Lumigo tracer with anonymization
const tracer = lumigo.initTracer({
    token: process.env.LUMIGO_TRACER_TOKEN,
    debug: true
});

const myHandler = async (event, context) => {
    console.log('EventProcessor Lambda started');
    console.log('🔧 Environment variables:');
    console.log('  - LUMIGO_ANONYMIZE_ENABLED:', process.env.LUMIGO_ANONYMIZE_ENABLED);
    console.log('  - LUMIGO_ANONYMIZE_REGEX:', process.env.LUMIGO_ANONYMIZE_REGEX);
    console.log('  - LUMIGO_ANONYMIZE_DATA_SCHEMA:', process.env.LUMIGO_ANONYMIZE_DATA_SCHEMA);
    console.log('🔍 Lambda received ORIGINAL event (not anonymized):');
    console.log('Event type:', event.type || 'unknown');
    console.log('Event data keys:', event.data ? Object.keys(event.data) : 'none');

    if (event.data && event.data.user) {
        console.log('✅ Lambda can access original user data:');
        console.log('  - User ID:', event.data.user.id);
        console.log('  - User Name:', event.data.user.name);
        console.log('  - User Email:', event.data.user.email);
        console.log('  - User SSN:', event.data.user.ssn);
        console.log('  - User Phone:', event.data.user.phone);
    }

    try {
        let eventData = {};
        let eventType = 'unknown';

        if (event.body) {
            try {
                const parsedBody = JSON.parse(event.body);
                eventType = parsedBody.type || 'unknown';
                eventData = parsedBody.data || {};
            } catch (parseError) {
                console.error('Error parsing event body:', parseError);
                eventData = { error: 'Failed to parse request body' };
            }
        } else {
            eventType = event.type || 'unknown';
            eventData = event.data || {};
        }

        const result = {
            message: 'Event processed successfully',
            timestamp: new Date().toISOString(),
            eventType: eventType,
            eventData: eventData,
            requestId: context.awsRequestId,
            processingNote: 'Lambda processed original, unmodified data. Using modified Lumigo tracer with PII anonymization.',
            anonymizationNote: 'PII data will be anonymized in Lumigo traces using embedded anonymization logic'
        };

        console.log('Processing result:', JSON.stringify(result, null, 2));
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            statusCode: 200,
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json'
            }
        };

    } catch (error) {
        console.error('Error processing event:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                requestId: context.awsRequestId
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};

exports.handler = tracer.trace(myHandler);
EOF
fi

# Create SAM template
echo "📋 Creating SAM template..."
if [ "$LAMBDA_NAME" = "lambdasAnonymous" ]; then
cp src/sam-templates/lambdasAnonymous.yaml deployment/${LAMBDA_NAME}-deploy/template.yaml
else
    cp src/sam-templates/eventProcessor.yaml deployment/${LAMBDA_NAME}-deploy/template.yaml
fi

# Create the template file if it doesn't exist (fallback)
if [ ! -f "deployment/${LAMBDA_NAME}-deploy/template.yaml" ]; then
    cat > deployment/${LAMBDA_NAME}-deploy/template.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: EventProcessor Lambda with Lumigo tracing

Parameters:
  LumigoToken:
    Type: String
    Description: Lumigo API token for tracing
    Default: t_f8f7b905da964eef89261
    NoEcho: false
  LumigoAnonymizeEnabled:
    Type: String
    Description: Enable/disable anonymization
    Default: "true"
    AllowedValues: ["true", "false"]
  LumigoAnonymizeRegex:
    Type: String
    Description: JSON array of regex patterns for anonymization
    Default: '["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]'
  LumigoAnonymizeDataSchema:
    Type: String
    Description: JSON array defining anonymization rules for specific fields
    Default: '[{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"}, {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "ssn", "type": "pattern", "pattern": "(\\d{3})-(\\d{2})-\\d{4}", "replacement": "$1-$2-****"}, {"field": "credit_card", "type": "pattern", "pattern": "(\\d{4})[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}", "replacement": "$1 **** **** ****"}, {"field": "phone", "type": "pattern", "pattern": "\\((\\d{3})\\) (\\d{3})-\\d{4}", "replacement": "($1) $2-****"}, {"field": "email", "type": "pattern", "pattern": "^([^@]{2})[^@]*@", "replacement": "$1***@"}, {"field": "ip_address", "type": "pattern", "pattern": "(\\d{1,3}\\.\\d{1,3})\\.\\d{1,3}\\.\\d{1,3}", "replacement": "$1.***.***"}]'

Resources:
  EventProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: ${LAMBDA_NAME}
      CodeUri: .
      Handler: ${LAMBDA_NAME}.handler
      Runtime: nodejs18.x
      Timeout: 30
      MemorySize: 128
      Environment:
        Variables:
          LUMIGO_TRACER_TOKEN: !Ref LumigoToken
          LUMIGO_ANONYMIZE_ENABLED: !Ref LumigoAnonymizeEnabled
          LUMIGO_ANONYMIZE_REGEX: !Ref LumigoAnonymizeRegex
          LUMIGO_ANONYMIZE_DATA_SCHEMA: !Ref LumigoAnonymizeDataSchema
      Policies:
        - CloudWatchLogsFullAccess
        - Statement:
            - Effect: Allow
              Action:
                - logs:CreateLogGroup
                - logs:CreateLogStream
                - logs:PutLogEvents
              Resource: '*'
        - Statement:
            - Effect: Allow
              Action:
                - lambda:InvokeFunction
              Resource: '*'
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /process
            Method: post

Outputs:
  EventProcessorFunction:
    Description: "EventProcessor Lambda Function ARN"
    Value: !GetAtt EventProcessorFunction.Arn
  EventProcessorApi:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/process"
EOF
fi

# Create samconfig.toml with basic parameters only
echo "📋 Creating SAM configuration..."
cat > deployment/${LAMBDA_NAME}-deploy/samconfig.toml << EOF
version = 0.1
[default.deploy.parameters]
stack_name = "${LAMBDA_NAME}-stack"
resolve_s3 = true
s3_prefix = "${LAMBDA_NAME}-stack"
region = "us-east-1"
confirm_changeset = true
capabilities = "CAPABILITY_IAM"
image_repositories = []
parameter_overrides = "LumigoToken=$LUMIGO_TRACER_TOKEN LumigoAnonymizeEnabled=$LUMIGO_ANONYMIZE_ENABLED"
EOF

# Build the custom tracer
echo "🔨 Building custom Lumigo tracer..."

# Clean any existing build artifacts
echo "🧹 Cleaning existing build artifacts..."
rm -rf build/
cd src/lumigo-tracer
rm -rf dist/ node_modules/ temp-build/ temp-dist/ test-compile/

# Fix TypeScript compilation issues
echo "🔧 Fixing TypeScript compilation issues..."
if [[ -f "hooks/baseHttp.ts" ]]; then
    cp hooks/baseHttp.ts hooks/baseHttp.ts.backup 2>/dev/null || true
    sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/baseHttp.ts 2>/dev/null || \
    sed -i 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/baseHttp.ts
fi

if [[ -f "hooks/http.ts" ]]; then
    cp hooks/http.ts hooks/http.ts.backup 2>/dev/null || true
    sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/http.ts 2>/dev/null || \
    sed -i 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/http.ts
fi

# Install dependencies with legacy peer deps to handle conflicts
echo "📦 Installing dependencies with legacy peer deps..."
npm install --legacy-peer-deps

# Build with TypeScript
echo "⚡ Compiling TypeScript..."
npm run build

# Convert ES6 modules to CommonJS
echo "🔄 Converting ES6 modules to CommonJS..."
npx babel dist --out-dir dist --extensions .js --source-maps

# Copy built files to build directory
echo "📁 Copying built files to build directory..."
mkdir -p ../../build/lumigo-node
cp -r dist/* ../../build/lumigo-node/
cp package.json ../../build/lumigo-node/

cd ../..

# Validate the build
echo "✅ Validating build..."
if ! grep -q "LUMIGO_ANONYMIZE" build/lumigo-node/tracer/tracer.js; then
    echo "❌ ERROR: Anonymization code not found in built tracer"
    exit 1
fi

if grep -q "import.*from" build/lumigo-node/tracer/tracer.js; then
    echo "❌ ERROR: ES6 imports found in built tracer - Babel conversion failed"
    exit 1
fi

echo "✅ Build validation passed"

# Copy built tracer to deployment
echo "📁 Copying built tracer to deployment..."
cp -R build/lumigo-node deployment/${LAMBDA_NAME}-deploy/

# Create a clean package.json for deployment (without dev dependencies that cause conflicts)
echo "📋 Creating clean package.json for deployment..."
if [ "$LAMBDA_NAME" = "lambdasAnonymous" ]; then
cp deployment/lambdasAnonymous-deploy/package.json deployment/${LAMBDA_NAME}-deploy/
else
    cat > deployment/${LAMBDA_NAME}-deploy/package.json << 'EOF'
{
  "name": "lambda-with-custom-tracer",
  "version": "1.0.0",
  "description": "Lambda function with custom Lumigo tracer",
  "main": "${LAMBDA_NAME}.js",
  "dependencies": {
    "@lumigo/node-core": "1.17.1",
    "agentkeepalive": "^4.1.4",
    "axios": "^1.11.0",
    "rfdc": "^1.4.1",
    "shimmer": "1.2.1",
    "utf8": "^3.0.0"
  }
}
EOF
fi

# Go to deployment directory
cd deployment/${LAMBDA_NAME}-deploy

# Build SAM application with npm conflict resolution
echo "🏗️ Building SAM application..."
echo "📝 Note: Handling npm dependency conflicts with --legacy-peer-deps..."

# Create .npmrc to handle peer dependency conflicts
cat > .npmrc << 'EOF'
legacy-peer-deps=true
fund=false
audit=false
EOF

# Build with error handling
if ! sam build; then
    echo "❌ SAM build failed. Attempting to resolve npm conflicts..."
    
    # Try manual npm install first
    echo "🔄 Running manual npm install with legacy peer deps..."
    npm install --legacy-peer-deps --force
    
    # Try building again
    echo "🔄 Retrying SAM build..."
    if ! sam build; then
        echo "❌ SAM build still failed. Manual intervention required."
        echo "💡 Check the error messages above and fix any configuration issues"
        echo "💡 Common fixes:"
        echo "   - Check samconfig.toml syntax"
        echo "   - Verify template.yaml is valid"
        echo "   - Ensure all required parameters are set"
        exit 1
    fi
fi

echo "✅ SAM build completed successfully"

# Generate unique S3 bucket name and update samconfig
echo "🔍 Setting up S3 bucket for SAM deployment..."
UNIQUE_SUFFIX=$(date +%s)
BUCKET_NAME="aws-sam-cli-managed-default-samclisourcebucket-${UNIQUE_SUFFIX}"
echo "📦 Using S3 bucket: $BUCKET_NAME"

# Create the S3 bucket
echo "📦 Creating S3 bucket: $BUCKET_NAME"
if ! aws s3 mb s3://$BUCKET_NAME; then
    echo "❌ Failed to create S3 bucket. Checking AWS credentials..."
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        echo "❌ AWS credentials not configured or expired."
        echo "💡 Run: aws sso login (or aws configure) to set up credentials"
        exit 1
    fi
    echo "❌ S3 bucket creation failed for another reason. Check AWS permissions."
    exit 1
fi

# Update samconfig.toml with the bucket name (remove resolve_s3 and add s3_bucket)
sed -i.bak "s/resolve_s3 = true/s3_bucket = \"$BUCKET_NAME\"/" samconfig.toml

# Deploy
echo "🚀 Deploying to AWS..."
sam deploy --no-confirm-changeset

# Update Lambda environment variables with the correct values
echo "🔧 Updating Lambda environment variables..."
aws lambda update-function-configuration \
  --function-name ${LAMBDA_NAME} \
  --environment Variables="{
    LUMIGO_TRACER_TOKEN=$LUMIGO_TRACER_TOKEN,
    LUMIGO_ANONYMIZE_ENABLED=$LUMIGO_ANONYMIZE_ENABLED,
    LUMIGO_ANONYMIZE_REGEX='$LUMIGO_ANONYMIZE_REGEX',
    LUMIGO_ANONYMIZE_DATA_SCHEMA='$LUMIGO_ANONYMIZE_DATA_SCHEMA'
  }"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 DEPLOYMENT SUMMARY:"
echo "======================"
echo "🔗 API Gateway URL: https://bea2wba4f8.execute-api.us-east-1.amazonaws.com/Prod/process"
echo "📦 Lambda Function: ${LAMBDA_NAME}"
echo "🌍 Region: us-east-1"
echo "🔧 Anonymization: $LUMIGO_ANONYMIZE_ENABLED"
echo ""
echo "🧪 TESTING:"
echo "==========="
echo "Test with curl:"
echo 'curl -X POST https://bea2wba4f8.execute-api.us-east-1.amazonaws.com/Prod/process \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"type":"user_registration","data":{"user":{"id":"123","name":"John Doe","email":"john@example.com","ssn":"123-45-6789","phone":"(555) 123-4567","address":"123 Main St, Anytown, USA"}}}'"'"''
echo ""
echo "📊 MONITORING:"
echo "=============="
echo "• Check CloudWatch logs: aws logs describe-log-groups --log-group-name-prefix /aws/lambda/${LAMBDA_NAME}"
echo "• View Lumigo traces: https://platform.lumigo.io/traces"
echo ""
echo "💡 To modify anonymization settings, edit ../deployment-config.env and run this script again"
echo "🗑️ The deployment directory is temporary and will be recreated on next run"
