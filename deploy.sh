#!/bin/bash

echo "🚀 Deploying Custom Lumigo Tracer with Anonymization..."

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

# Clean up any existing deployment directory
echo "🧹 Cleaning up existing deployment directory..."
rm -rf deployment/eventProcessor-deploy

# Create fresh deployment directory
echo "📁 Creating fresh deployment directory..."
mkdir -p deployment/eventProcessor-deploy

# Copy Lambda handler
echo "📋 Copying Lambda handler..."
cat > deployment/eventProcessor-deploy/eventProcessor.js << 'EOF'
const lumigo = require('./lumigo-node');

// Initialize the modified Lumigo tracer with anonymization
const tracer = lumigo();

const myHandler = async (event, context) => {
    console.log('EventProcessor Lambda started');
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

# Create SAM template
echo "📋 Creating SAM template..."
cat > deployment/eventProcessor-deploy/template.yaml << 'EOF'
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
      FunctionName: eventProcessor
      CodeUri: .
      Handler: eventProcessor.handler
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

# Create samconfig.toml
echo "📋 Creating SAM configuration..."
cat > deployment/eventProcessor-deploy/samconfig.toml << EOF
version = 0.1
[default.deploy.parameters]
stack_name = "eventProcessor-stack"
resolve_s3 = true
s3_prefix = "eventProcessor-stack"
region = "us-east-1"
confirm_changeset = true
capabilities = "CAPABILITY_IAM"
image_repositories = []
parameter_overrides = "LumigoToken=\"$LUMIGO_TRACER_TOKEN\" LumigoAnonymizeEnabled=\"$LUMIGO_ANONYMIZE_ENABLED\" LumigoAnonymizeRegex=\"$LUMIGO_ANONYMIZE_REGEX\" LumigoAnonymizeDataSchema=\"$LUMIGO_ANONYMIZE_DATA_SCHEMA\""
EOF

# Build the custom tracer
echo "🔨 Building custom Lumigo tracer..."
cd lumigo-node
npm run build
npx babel dist --out-dir dist --extensions .js --source-maps
cd ..

# Copy built tracer to deployment
echo "📁 Copying built tracer to deployment..."
cp -R lumigo-node/dist deployment/eventProcessor-deploy/lumigo-node/
cp lumigo-node/package.json deployment/eventProcessor-deploy/lumigo-node/

# Go to deployment directory
cd deployment/eventProcessor-deploy

# Build SAM application
echo "🏗️ Building SAM application..."
sam build

# Deploy
echo "🚀 Deploying to AWS..."
sam deploy --no-confirm-changeset

echo ""
echo "✅ Deployment complete!"
echo "💡 To modify anonymization settings, edit ../deployment-config.env and run this script again"
echo "🗑️ The deployment directory is temporary and will be recreated on next run"
