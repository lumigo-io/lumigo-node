# Lumigo Tracer Custom Anonymization

This project demonstrates how to inject custom data anonymization logic directly into Lumigo's tracer source code to anonymize sensitive data before it's sent to Lumigo.

## Overview

This approach modifies the core Lumigo tracer source code (`lumigo-node/src/tracer/tracer.ts`) to include built-in anonymization logic. This ensures that:

1. **Lumigo's tracer works normally** - All tracing functionality is preserved
2. **Data is anonymized before processing** - Sensitive data is replaced with realistic fake data
3. **Traces are sent to Lumigo** - The anonymized data appears in Lumigo's traces
4. **Original data preserved in logs** - Lambda logs show original data for debugging

## How It Works

1. **Source Code Modification**: Custom anonymization logic is injected directly into `lumigo-node/src/tracer/tracer.ts`
2. **TypeScript Build**: The modified source is compiled using TypeScript (`npm run build`)
3. **Babel Conversion**: ES6 modules are converted to CommonJS using Babel for Lambda compatibility
4. **Deployment**: The built tracer is deployed with the Lambda function
5. **Runtime Anonymization**: When Lumigo processes events, our custom logic anonymizes sensitive data

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- SAM CLI installed (`brew install aws-sam-cli` on macOS)
- Access to a Lumigo account with tracer token

### 1. Configure Environment Variables

**Option A: Interactive Setup (Recommended)**
```bash
./scripts/setup-env.sh
```

**Option B: Manual Setup**
Follow the [Setup Guide](SETUP_GUIDE.md) and edit `deployment-config.env` with your Lumigo token:

```bash
# Lumigo Configuration
LUMIGO_TRACER_TOKEN=your_lumigo_token_here
LUMIGO_ANONYMIZE_ENABLED=true

# Anonymization Patterns
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", ".*ipv6.*", ".*ip.*", "address", "zip.*code", "date.*of.*birth", "session.*token", "auth.*token"]'

# Data Schema for Anonymization - Multiple types supported
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "ssn", "type": "partial", "keep": 5}, {"field": "credit.*card", "type": "truncate", "maxChars": 16, "position": "end"}, {"field": "phone", "type": "truncate", "maxChars": 8, "position": "end"}, {"field": "email", "type": "truncate", "maxChars": 10, "position": "end"}, {"field": ".*ipv6.*", "type": "partial", "keep": 2, "separator": ":"}, {"field": ".*ip.*", "type": "partial", "keep": 2, "separator": "."}, {"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "session.*token", "type": "partial", "keep": 8}, {"field": "auth.*token", "type": "partial", "keep": 8}]'
```

### 2. Deploy Example Lambda Function

```bash
# Deploy the example Lambda function from src/lambda-handlers/
./deploy.sh
```

**Note:** This deploys the example Lambda function (`lambdasAnonymous.js`) using SAM, which is different from the layer integration approaches documented below.

This script will:
- ✅ Build the custom tracer with anonymization
- ✅ Handle npm dependency conflicts automatically
- ✅ Deploy to AWS Lambda with API Gateway
- ✅ Configure environment variables correctly
- ✅ Provide testing instructions

---

## 🔧 **Integration Approaches**

The custom Lumigo tracer can be integrated in three different ways:

### **Option 1: Deploy Example Lambda Function** (Above)
- Uses `./deploy.sh` script
- Deploys `src/lambda-handlers/lambdasAnonymous.js` with SAM
- Good for: Testing the complete system end-to-end

### **Option 2: Create New Test Lambda Function** (Below)
- Uses the template in `src/test-lambda/`
- Creates a new Lambda function with the custom tracer as a layer
- Good for: Testing layer integration from scratch

### **Option 3: Add Layer to Existing Lambda Function** (Below)
- Adds the custom tracer layer to an existing Lambda function
- Good for: Production integration with existing workloads

---

### 3. Test the Deployment

#### Getting Your API Gateway URL

The deployment script will output the API Gateway URL, but you can also retrieve it manually using any of these methods:

**Method 1: From CloudFormation Stack Outputs**
```bash
# Get the full API Gateway URL
aws cloudformation describe-stacks --stack-name lambdasAnonymous-stack --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text

# Or get all outputs to see everything
aws cloudformation describe-stacks --stack-name lambdasAnonymous-stack --query 'Stacks[0].Outputs'
```

**Method 2: From AWS Console**
1. Go to [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation/)
2. Find the `lambdasAnonymous-stack` stack
3. Click on the **Outputs** tab
4. Copy the value for `ApiGatewayUrl`

**Method 3: From API Gateway Console**
1. Go to [AWS API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. Find your API (named `lambdasAnonymous-api`)
3. Click on **Stages** → **Prod**
4. Copy the **Invoke URL** and add `/process` to the end

**Method 4: Using AWS CLI to list APIs**
```bash
# List all APIs and find yours
aws apigateway get-rest-apis --query 'items[?name==`lambdasAnonymous-api`]'

# Get the specific API ID and construct the URL
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`lambdasAnonymous-api`].id' --output text)
echo "https://${API_ID}.execute-api.$(aws configure get region).amazonaws.com/Prod/process"
```

**Quick Reference - One-liner to get your URL:**
```bash
# Set your API Gateway URL as an environment variable for easy testing
export API_GATEWAY_URL=$(aws cloudformation describe-stacks --stack-name lambdasAnonymous-stack --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text)
echo "Your API Gateway URL: $API_GATEWAY_URL"
```

#### Testing Your Deployment

Once you have your API Gateway URL, test with:

```bash
# Option 1: Use the environment variable (if you ran the quick reference command above)
curl -X POST $API_GATEWAY_URL \

# Option 2: Or set it manually
# API_GATEWAY_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/Prod/process"
# curl -X POST $API_GATEWAY_URL \

# Note: Replace the test data below with your own sensitive data to test anonymization
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_registration",
    "data": {
      "user": {
        "name": "Test User",
        "email": "test@example.com",
        "ssn": "123-45-6789",
        "phone": "(555) 123-4567",
        "address": "123 Test Street, Test City, USA 12345",
        "credit_card": "4532 1234 5678 9012",
        "ip_address": "192.168.1.100",
        "session_token": "sess_test123456789",
        "auth_token": "auth_test987654321",
        "driver_license": "DL123456789",
        "passport_number": "P123456789",
        "bank_account": "1234567890",
        "zip_code": "12345",
        "date_of_birth": "1990-01-15"
      },
      "payment": {
        "credit_card_number": "4532-1234-5678-9012",
        "cvv": "123",
        "expiry": "12/25"
      },
      "contact": {
        "email_address": "contact@example.com",
        "phone_number": "+1-555-987-6543",
        "home_address": "456 Test Avenue, Test City, IL 62701"
      }
    }
  }' | jq .
```

### 3b. Test IPv6 Address Anonymization

```bash
# Test IPv6 anonymization (uses the same $API_GATEWAY_URL environment variable)
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ip_test",
    "data": {
      "ip_address": "192.168.1.100",
      "primary_ip": "10.0.0.1",
      "secondary_ip": "203.0.113.1",
      "ipv6_address": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      "ipv6_primary": "2001:db8::1",
      "ipv6_secondary": "fe80::1"
    }
  }' | jq .
```

### 4. Verify Anonymization

Check CloudWatch logs for:
- ✅ **"🔒 ANONYMIZATION: Return value anonymized for Lumigo traces"**
- ✅ **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ **"Tracer ended"** with **"totalSpans":2**

## Files

- **`src/lumigo-tracer/tracer/tracer.ts`** - Core Lumigo tracer with embedded anonymization logic
- **`src/lambda-handlers/lambdasAnonymous.js`** - Example Lambda handler with anonymization testing
- **`src/sam-templates/lambdasAnonymous.yaml`** - SAM template for deployment
- **`deploy.sh`** - Automated deployment script
- **`package-tracer.sh`** - Build script for the custom tracer

## Environment Variables

- **`LUMIGO_ANONYMIZE_ENABLED`** - Set to `true` to enable anonymization (default: disabled)
- **`LUMIGO_ANONYMIZE_REGEX`** - JSON array of regex patterns to match sensitive fields
- **`LUMIGO_ANONYMIZE_DATA_SCHEMA`** - JSON array defining anonymization rules for specific fields
- **`LUMIGO_TRACER_TOKEN`** - Your Lumigo tracer token

## Anonymization Rules

The current implementation supports **multiple anonymization types**:

### Partial Anonymization (keeps part of the data):
- **SSN**: Keeps last 5 characters (`123-45-6789` → `***-45-6789`)
- **Session Token**: Keeps first 8 characters (`sess_abc123...` → `sess_abc***`)
- **Auth Token**: Keeps first 8 characters (`auth_zyx987...` → `auth_zyx***`)
- **IPv4 Addresses**: Keeps first 2 octets (`192.168.1.100` → `192.168.***.***`)
- **IPv6 Addresses**: Keeps first 2 segments (`2001:0db8:...` → `2001:0db8:***:***`)

### Truncation Anonymization (shortens data):
- **Credit Card**: Truncated to 16 characters from the end
- **Phone**: Truncated to 8 characters from the end
- **Email**: Truncated to 10 characters from the end
- **Address**: Truncated to 20 characters from the end

### Pattern-based Anonymization:
- **Driver License, Passport, Bank Account**: Replaced with `[ANONYMIZED]`
- **Zip Code, Date of Birth**: Replaced with `[ANONYMIZED]`

## Benefits

- **Built-in functionality** - Anonymization is part of the core tracer
- **Preserves functionality** - All Lumigo features continue to work
- **Real-time processing** - Data is anonymized as it flows through the system
- **Configurable** - Can be enabled/disabled and customized via environment variables
- **Lambda compatible** - CommonJS modules work natively in Lambda

## Troubleshooting

### Common Issues

1. **AWS SSO Token Expired**: Run `aws sso login` to refresh credentials
2. **npm Dependency Conflicts**: The deploy script handles this automatically with `--legacy-peer-deps`
3. **JSON Parsing Errors**: Check that environment variables are properly quoted in `deployment-config.env`
4. **Module Not Found**: Verify the deploy script completed successfully
5. **Missing Dependencies**: If you get `Cannot find module '@lumigo/node-core'` or similar errors, see the Technical Guide
6. **Babel Configuration Error**: If you get `.babelrc` not found errors, the automated build should handle this

### Build Verification

The deploy script automatically verifies the build:

```bash
# Check that anonymization code is present
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js

# Check that no ES6 imports remain  
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js  # Should return nothing
```

### Deployment Verification

Check CloudWatch logs for successful execution:
- ✅ **"🔒 ANONYMIZATION: Return value anonymized for Lumigo traces"**
- ✅ **"Spans sent [Xms, Y spans]"** with **"status":200**
- ❌ **"Failed to anonymize return value"** (indicates an issue)

## 🔧 Integrating with Existing Lambdas

This custom tracer is designed to instrument existing Lambda functions deployed via CDK, Terraform, Serverless Framework, or other infrastructure tools.

### Prerequisites for Integration

1. **Build the Custom Tracer**: First, build the custom tracer with anonymization:
   ```bash
   ./package-tracer.sh
   ```

2. **Deploy as Lambda Layer**: The custom tracer can be deployed as a Lambda Layer for easy integration:
   ```bash
   # Create a layer package
   mkdir -p layer/nodejs
   cp -r lumigo-node/dist/* layer/nodejs/
   cd layer
   zip -r ../lumigo-custom-tracer-layer.zip .
   cd ..
   
   # Deploy the layer
   aws lambda publish-layer-version \
     --layer-name lumigo-custom-tracer \
     --zip-file fileb://lumigo-custom-tracer-layer.zip \
     --compatible-runtimes nodejs18.x nodejs20.x
   ```

### Integration Methods

#### Method 1: Lambda Layer Integration

**For CDK (TypeScript):**
```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';

// Get the layer ARN (replace with your actual layer ARN)
const customTracerLayer = lambda.LayerVersion.fromLayerVersionArn(
  this,
  'CustomTracerLayer',
  'arn:aws:lambda:us-east-1:123456789012:layer:lumigo-custom-tracer:1'
);

// Add to your existing Lambda
const myLambda = new lambdaNodejs.NodejsFunction(this, 'MyLambda', {
  // ... your existing configuration
  layers: [customTracerLayer],
  environment: {
    LUMIGO_TRACER_TOKEN: 'your_lumigo_token_here',
    LUMIGO_ANONYMIZE_ENABLED: 'true',
    LUMIGO_ANONYMIZE_REGEX: '["ssn", "credit.*card", "email", "phone"]',
    LUMIGO_ANONYMIZE_DATA_SCHEMA: '[{"field": "ssn", "type": "partial", "keep": 5}]'
  }
});
```

**For Terraform:**
```hcl
# Get the layer
data "aws_lambda_layer_version" "custom_tracer" {
  layer_name = "lumigo-custom-tracer"
  version_number = 1
}

# Add to your existing Lambda
resource "aws_lambda_function" "my_lambda" {
  # ... your existing configuration
  layers = [data.aws_lambda_layer_version.custom_tracer.arn]
  
  environment {
    variables = {
      LUMIGO_TRACER_TOKEN = "your_lumigo_token_here"
      LUMIGO_ANONYMIZE_ENABLED = "true"
      LUMIGO_ANONYMIZE_REGEX = "[\"ssn\", \"credit.*card\", \"email\", \"phone\"]"
      LUMIGO_ANONYMIZE_DATA_SCHEMA = "[{\"field\": \"ssn\", \"type\": \"partial\", \"keep\": 5}]"
    }
  }
}
```

**For Serverless Framework:**
```yaml
# serverless.yml
functions:
  myFunction:
    handler: src/handler.handler
    layers:
      - arn:aws:lambda:us-east-1:123456789012:layer:lumigo-custom-tracer:1
    environment:
      LUMIGO_TRACER_TOKEN: ${env:LUMIGO_TRACER_TOKEN}
      LUMIGO_ANONYMIZE_ENABLED: true
      LUMIGO_ANONYMIZE_REGEX: '["ssn", "credit.*card", "email", "phone"]'
      LUMIGO_ANONYMIZE_DATA_SCHEMA: '[{"field": "ssn", "type": "partial", "keep": 5}]'
```

**For SAM (Serverless Application Model):**
```yaml
# template.yaml
Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: index.handler
      Runtime: nodejs18.x
      Layers:
        - !Ref CustomTracerLayer
      Environment:
        Variables:
          LUMIGO_TRACER_TOKEN: !Ref LumigoTracerToken
          LUMIGO_ANONYMIZE_ENABLED: true
          LUMIGO_ANONYMIZE_REGEX: '["ssn", "credit.*card", "email", "phone"]'

  CustomTracerLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: lumigo-custom-tracer
      Description: Custom Lumigo tracer with anonymization
      ContentUri: layer/
      CompatibleRuntimes:
        - nodejs18.x
        - nodejs20.x

Parameters:
  LumigoTracerToken:
    Type: String
    Description: Lumigo tracer token
    NoEcho: true
```

**For Pulumi (TypeScript):**
```typescript
import * as aws from "@pulumi/aws";

// Create the layer
const customTracerLayer = new aws.lambda.LayerVersion("customTracerLayer", {
  layerName: "lumigo-custom-tracer",
  description: "Custom Lumigo tracer with anonymization",
  code: new pulumi.asset.FileArchive("layer.zip"),
  compatibleRuntimes: ["nodejs18.x", "nodejs20.x"],
});

// Add to your existing Lambda
const myLambda = new aws.lambda.Function("myLambda", {
  // ... your existing configuration
  layers: [customTracerLayer.arn],
  environment: {
    variables: {
      LUMIGO_TRACER_TOKEN: "your_lumigo_token_here",
      LUMIGO_ANONYMIZE_ENABLED: "true",
      LUMIGO_ANONYMIZE_REGEX: '["ssn", "credit.*card", "email", "phone"]',
      LUMIGO_ANONYMIZE_DATA_SCHEMA: '[{"field": "ssn", "type": "partial", "keep": 5}]'
    }
  }
});
```

#### Method 2: Direct Package Integration

**For CDK with inline code:**
```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';

const myLambda = new lambda.Function(this, 'MyLambda', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('path/to/your/lambda/code', {
    bundling: {
      image: lambda.Runtime.NODEJS_18_X.bundlingImage,
      command: [
        'bash', '-c', [
          'cp -r /asset-input/* /asset-output/',
          'cp -r /asset-input/../lumigo-node/dist/* /asset-output/node_modules/@lumigo/tracer/',
          'cd /asset-output && npm install'
        ].join(' && ')
      ]
    }
  }),
  environment: {
    LUMIGO_TRACER_TOKEN: 'your_lumigo_token_here',
    LUMIGO_ANONYMIZE_ENABLED: 'true'
  }
});
```

#### Method 3: Container Image Integration

**For CDK with container images:**
```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';

const myLambda = new lambda.DockerImageFunction(this, 'MyLambda', {
  code: lambda.DockerImageCode.fromImageAsset('path/to/your/dockerfile'),
  environment: {
    LUMIGO_TRACER_TOKEN: 'your_lumigo_token_here',
    LUMIGO_ANONYMIZE_ENABLED: 'true'
  }
});
```

**Dockerfile example:**
```dockerfile
FROM public.ecr.aws/lambda/nodejs:18

# Copy your application code
COPY . .

# Copy the custom tracer
COPY ../lumigo-node/dist ./node_modules/@lumigo/tracer

# Install dependencies
RUN npm install

CMD ["index.handler"]
```

### Lambda Function Code Integration

**Update your existing Lambda handler:**
```javascript
// index.js
const { lumigo } = require('@lumigo/tracer');

// Wrap your existing handler
exports.handler = lumigo(async (event, context) => {
  // Your existing Lambda logic here
  console.log('Processing event:', event);
  
  // The custom tracer will automatically anonymize sensitive data
  // before sending traces to Lumigo
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Success',
      // Sensitive data in the response will be anonymized
      userData: event.userData
    })
  };
});
```

### Migrating from Standard Lumigo Tracer

If you're already using the standard Lumigo tracer, migration is straightforward:

**Before (Standard Lumigo):**
```javascript
const { lumigo } = require('@lumigo/tracer');

exports.handler = lumigo(async (event, context) => {
  // Your Lambda logic
});
```

**After (Custom Anonymization Tracer):**
```javascript
// Same code! Just change the import path
const { lumigo } = require('@lumigo/tracer');

exports.handler = lumigo(async (event, context) => {
  // Your Lambda logic - no changes needed
  // Anonymization happens automatically
});
```

**Key Differences:**
- ✅ **Same API** - No code changes required
- ✅ **Automatic anonymization** - Sensitive data is anonymized before sending to Lumigo
- ✅ **Same environment variables** - Uses standard Lumigo environment variables
- ✅ **Additional anonymization config** - Add `LUMIGO_ANONYMIZE_*` variables for customization

### Environment Variables for Existing Lambdas

Add these environment variables to your existing Lambda configuration:

```bash
# Required
LUMIGO_TRACER_TOKEN=your_lumigo_token_here
LUMIGO_ANONYMIZE_ENABLED=true

# Optional - Customize anonymization patterns
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", ".*ipv6.*", ".*ip.*", "address", "zip.*code", "date.*of.*birth", "session.*token", "auth.*token"]'

# Optional - Define anonymization rules
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "ssn", "type": "partial", "keep": 5}, {"field": "credit.*card", "type": "truncate", "maxChars": 16, "position": "end"}, {"field": "phone", "type": "truncate", "maxChars": 8, "position": "end"}, {"field": "email", "type": "truncate", "maxChars": 10, "position": "end"}]'
```

### Testing Integration

**Test your existing Lambda with anonymization:**
```bash
# Test with sensitive data
aws lambda invoke \
  --function-name your-existing-lambda \
  --payload '{"userData": {"ssn": "123-45-6789", "email": "test@example.com"}}' \
  response.json

# Check CloudWatch logs for anonymization
aws logs filter-log-events \
  --log-group-name /aws/lambda/your-existing-lambda \
  --filter-pattern "ANONYMIZATION"
```

## 🧪 **Option 2: Create New Test Lambda Function**

This approach uses the provided template in `src/test-lambda/` to create a new Lambda function specifically for testing the custom tracer as a layer.

### Prerequisites for New Lambda Testing

- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- Access to a Lumigo account with tracer token

### Step 1A: Build and Deploy the Custom Tracer Layer

**Build the custom tracer:**
```bash
# Build the tracer with anonymization
./package-tracer.sh layer --clean --skip-tests
```

**Deploy the layer to AWS:**
```bash
# Get the layer ARN from the build output
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name lumigo-custom-tracer-layer \
  --zip-file fileb://packages/layer-package.zip \
  --compatible-runtimes nodejs18.x nodejs20.x \
  --description "Custom Lumigo tracer with anonymization" \
  --query 'LayerVersionArn' --output text)

echo "Layer ARN: $LAYER_ARN"
```

### Step 1B: Create Test Lambda Function

**The test Lambda function is included in the source code at `src/test-lambda/`.**

**To use the provided test Lambda function:**
```bash
# Navigate to the test Lambda directory
cd src/test-lambda

# The test Lambda function is already created with the following files:
# - index.js: Lambda handler with custom tracer integration
# - package.json: Lambda function dependencies
# - payload.json: Test payload with sensitive data
# - env-vars.json: Environment variables template
# - README.md: Detailed usage instructions

# Package the Lambda function
zip -r test-lambda.zip .

# Deploy the Lambda function
aws lambda create-function \
  --function-name test-lambda-custom-tracer \
  --runtime nodejs18.x \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://test-lambda.zip \
  --environment file://env-vars.json \
  --timeout 30 \
  --memory-size 128 \
  --layers $LAYER_ARN

# Alternative: Create Lambda function manually (for reference)
cat > index.js << 'EOF'
const { lumigo } = require('/opt/nodejs');

const lumigoTracer = lumigo({ token: process.env.LUMIGO_TRACER_TOKEN });

exports.handler = lumigoTracer.trace(async (event, context) => {
  console.log('Processing event:', JSON.stringify(event, null, 2));
  
  // Simulate processing sensitive data
  const userData = {
    name: "John Doe",
    email: "john.doe@example.com",
    ssn: "123-45-6789",
    phone: "(555) 123-4567",
    credit_card: "4532 1234 5678 9012",
    address: "123 Main Street, Anytown, USA 12345",
    ip_address: "192.168.1.100"
  };
  
  console.log('Original user data:', JSON.stringify(userData, null, 2));
  
  // Simulate some processing
  const result = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Success',
      userData: userData, // This should be anonymized in Lumigo traces
      timestamp: new Date().toISOString()
    })
  };
  
  console.log('Returning result:', JSON.stringify(result, null, 2));
  
  return result;
});
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "test-lambda-with-custom-tracer",
  "version": "1.0.0",
  "description": "Test Lambda function with custom Lumigo tracer",
  "main": "index.js"
}
EOF

# Create test payload
cat > payload.json << 'EOF'
{
  "test": "data",
  "user": {
    "ssn": "123-45-6789",
    "email": "test@example.com",
    "credit_card": "4532 1234 5678 9012",
    "phone": "(555) 123-4567",
    "address": "123 Main Street, Anytown, USA 12345",
    "ip_address": "192.168.1.100"
  }
}
EOF

# Create environment variables file
cat > env-vars.json << 'EOF'
{
  "Variables": {
    "LUMIGO_TRACER_TOKEN": "your_lumigo_token_here",
    "LUMIGO_ANONYMIZE_ENABLED": "true",
    "LUMIGO_ANONYMIZE_REGEX": "[\"ssn\", \"credit.*card\", \"email\", \"phone\", \"address\", \"ip.*\"]",
    "LUMIGO_ANONYMIZE_DATA_SCHEMA": "[{\"field\": \"ssn\", \"type\": \"partial\", \"keep\": 5}, {\"field\": \"credit.*card\", \"type\": \"truncate\", \"maxChars\": 16, \"position\": \"end\"}, {\"field\": \"phone\", \"type\": \"truncate\", \"maxChars\": 8, \"position\": \"end\"}, {\"field\": \"email\", \"type\": \"truncate\", \"maxChars\": 10, \"position\": \"end\"}, {\"field\": \"address\", \"type\": \"truncate\", \"maxChars\": 20, \"position\": \"end\"}, {\"field\": \"ip.*\", \"type\": \"partial\", \"keep\": 2, \"separator\": \".\"}]"
  }
}
EOF
```

### Step 1C: Deploy Test Lambda Function

**Package and deploy the Lambda:**
```bash
# Package the Lambda function
zip -r test-lambda.zip .

# Create IAM role for Lambda (if it doesn't exist)
aws iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' || echo "Role already exists"

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Wait for role to be ready
sleep 10

# Create Lambda function
aws lambda create-function \
  --function-name test-lambda-custom-tracer \
  --runtime nodejs18.x \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://test-lambda.zip \
  --environment file://env-vars.json \
  --timeout 30 \
  --memory-size 128

# Add the custom tracer layer
aws lambda update-function-configuration \
  --function-name test-lambda-custom-tracer \
  --layers $LAYER_ARN
```

### Step 1D: Test the Integration

**Test with sensitive data:**
```bash
# Test the Lambda function
aws lambda invoke \
  --function-name test-lambda-custom-tracer \
  --payload fileb://payload.json \
  response.json

# View the response
cat response.json
```

**Expected Response:**
```json
{
  "statusCode": 200,
  "body": "{\"message\":\"Success\",\"userData\":{\"name\":\"John Doe\",\"email\":\"john.doe@example.com\",\"ssn\":\"123-45-6789\",\"phone\":\"(555) 123-4567\",\"credit_card\":\"4532 1234 5678 9012\",\"address\":\"123 Main Street, Anytown, USA 12345\",\"ip_address\":\"192.168.1.100\"},\"timestamp\":\"2025-09-10T22:14:13.964Z\"}"
}
```

### Step 1E: Verify Anonymization in CloudWatch Logs

**Check CloudWatch logs for anonymization:**
```bash
# Get the latest log stream
LOG_STREAM=$(aws logs describe-log-streams \
  --log-group-name "/aws/lambda/test-lambda-custom-tracer" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text)

# Get recent logs
aws logs get-log-events \
  --log-group-name "/aws/lambda/test-lambda-custom-tracer" \
  --log-stream-name "$LOG_STREAM" \
  --start-time $(date -d '5 minutes ago' +%s)000
```

**Look for these key indicators in the logs:**

✅ **Anonymized Input Event:**
```json
{
  "test": "data",
  "user": {
    "ssn": "123-4******",           // ← ANONYMIZED!
    "email": "test@examp***",       // ← ANONYMIZED!
    "credit_card": "4532 1234 5678 9***", // ← ANONYMIZED!
    "phone": "(555) 12***",         // ← ANONYMIZED!
    "address": "123 Main Street, Any***", // ← ANONYMIZED!
    "ip_address": "192.168.1.100"   // ← NOT anonymized (as configured)
  }
}
```

✅ **Original Data in Lambda Logs:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",  // ← Original data preserved
  "ssn": "123-45-6789",            // ← Original data preserved
  "phone": "(555) 123-4567",       // ← Original data preserved
  "credit_card": "4532 1234 5678 9012", // ← Original data preserved
  "address": "123 Main Street, Anytown, USA 12345", // ← Original data preserved
  "ip_address": "192.168.1.100"    // ← Original data preserved
}
```

### Step 1F: Validate Test Lambda Function

**If you need to recreate the test Lambda function (e.g., after deletion):**

```bash
# Navigate to the test Lambda source directory
cd src/test-lambda

# Package the Lambda function
zip -r test-lambda.zip .

# Recreate the Lambda function
aws lambda create-function \
  --function-name test-lambda-custom-tracer \
  --runtime nodejs18.x \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://test-lambda.zip \
  --environment file://env-vars.json \
  --timeout 30 \
  --memory-size 128 \
  --layers $LAYER_ARN

# Update with your actual Lumigo token
aws lambda update-function-configuration \
  --function-name test-lambda-custom-tracer \
  --environment 'Variables={"LUMIGO_TRACER_TOKEN":"your_actual_token_here","LUMIGO_ANONYMIZE_ENABLED":"true","LUMIGO_ANONYMIZE_REGEX":"[\"ssn\", \"credit.*card\", \"email\", \"phone\", \"address\", \"ip.*\"]","LUMIGO_ANONYMIZE_DATA_SCHEMA":"[{\"field\": \"ssn\", \"type\": \"partial\", \"keep\": 5}, {\"field\": \"credit.*card\", \"type\": \"truncate\", \"maxChars\": 16, \"position\": \"end\"}, {\"field\": \"phone\", \"type\": \"truncate\", \"maxChars\": 8, \"position\": \"end\"}, {\"field\": \"email\", \"type\": \"truncate\", \"maxChars\": 10, \"position\": \"end\"}, {\"field\": \"address\", \"type\": \"truncate\", \"maxChars\": 20, \"position\": \"end\"}, {\"field\": \"ip.*\", \"type\": \"partial\", \"keep\": 2, \"separator\": \".\"}]"}'

# Test the recreated function
aws lambda invoke \
  --function-name test-lambda-custom-tracer \
  --payload fileb://payload.json response.json && cat response.json
```

### Step 1G: Clean Up Test Resources

**Remove test resources:**
```bash
# Delete the test Lambda function
aws lambda delete-function --function-name test-lambda-custom-tracer

# Delete the test log group
aws logs delete-log-group --log-group-name "/aws/lambda/test-lambda-custom-tracer"

# Clean up local files (test Lambda source remains in src/test-lambda/)
cd ../..
```

---

## 🧪 **Option 3: Add Layer to Existing Lambda Function**

**This approach adds the custom tracer layer to an existing Lambda function without creating a new one.**

**Prerequisites:**
- Existing Lambda function running Node.js 18.x or 20.x
- AWS CLI configured with appropriate permissions
- Access to a Lumigo account with tracer token

### Step 2A: Build and Deploy the Custom Tracer Layer

**Build the custom tracer:**
```bash
# Build the tracer with anonymization
./package-tracer.sh layer --clean --skip-tests
```

**Deploy the layer to AWS:**
```bash
# Get the layer ARN from the build output
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name lumigo-custom-tracer-layer \
  --zip-file fileb://packages/layer-package.zip \
  --compatible-runtimes nodejs18.x nodejs20.x \
  --description "Custom Lumigo tracer with anonymization" \
  --query 'LayerVersionArn' --output text)

echo "Layer ARN: $LAYER_ARN"
```

### Step 2B: Add Layer to Existing Lambda Function

**To use the custom tracer layer with existing Lambda functions:**

1. **Add the layer to your Lambda function:**
   ```bash
   aws lambda update-function-configuration \
     --function-name your-existing-lambda \
     --layers $LAYER_ARN
   ```

2. **Update your Lambda function code:**
   ```javascript
   // Change from:
   const { lumigo } = require('@lumigo/tracer');
   
   // To:
   const { lumigo } = require('/opt/nodejs');
   const lumigoTracer = lumigo({ token: process.env.LUMIGO_TRACER_TOKEN });
   
   // Change from:
   exports.handler = lumigo(async (event, context) => {
   
   // To:
   exports.handler = lumigoTracer.trace(async (event, context) => {
   ```

3. **Add environment variables:**
   ```bash
   aws lambda update-function-configuration \
     --function-name your-existing-lambda \
     --environment Variables='{
       "LUMIGO_TRACER_TOKEN":"your_actual_lumigo_token_here",
       "LUMIGO_ANONYMIZE_ENABLED":"true",
       "LUMIGO_ANONYMIZE_REGEX":"[\"ssn\", \"credit.*card\", \"email\", \"phone\", \"address\", \"ip.*\"]",
       "LUMIGO_ANONYMIZE_DATA_SCHEMA":"[{\"field\": \"ssn\", \"type\": \"partial\", \"keep\": 5}, {\"field\": \"credit.*card\", \"type\": \"truncate\", \"maxChars\": 16, \"position\": \"end\"}, {\"field\": \"phone\", \"type\": \"truncate\", \"maxChars\": 8, \"position\": \"end\"}, {\"field\": \"email\", \"type\": \"truncate\", \"maxChars\": 10, \"position\": \"end\"}, {\"field\": \"address\", \"type\": \"truncate\", \"maxChars\": 20, \"position\": \"end\"}, {\"field\": \"ip.*\", \"type\": \"partial\", \"keep\": 2, \"separator\": \".\"}]"
     }'
   ```

4. **Test the integration** by invoking your Lambda function and checking CloudWatch logs for anonymized data

### Troubleshooting Layer Integration

**Common Issues and Solutions:**

1. **"Cannot find module '/opt/nodejs'"**
   - Ensure the layer is properly attached to the Lambda function
   - Check that the layer ARN is correct

2. **"Cannot find module '../package.json'"**
   - This is fixed in layer version 6+ (includes package.json in correct location)

3. **"Invalid Token" warnings**
   - Verify your `LUMIGO_TRACER_TOKEN` environment variable is set correctly
   - Ensure the token is valid and active

4. **No spans appearing in Lumigo**
   - Check CloudWatch logs for tracer initialization messages
   - Verify the token is valid and has proper permissions
   - Ensure anonymization is working (check for anonymized data in logs)

---

## **Summary: Three Integration Approaches**

### **Option 1: Deploy Example Lambda Function**
- ✅ **Use when:** You want to test the complete system end-to-end
- ✅ **What it does:** Deploys `src/lambda-handlers/lambdasAnonymous.js` with SAM
- ✅ **Best for:** Quick testing and validation of the complete system
- ✅ **Files used:** `./deploy.sh` script + `src/lambda-handlers/lambdasAnonymous.js`

### **Option 2: Create New Test Lambda Function**
- ✅ **Use when:** You want to test the custom tracer as a layer from scratch
- ✅ **What it does:** Builds layer + creates a new Lambda function using the template in `src/test-lambda/`
- ✅ **Best for:** Testing layer integration, validation, and learning how the tracer works
- ✅ **Files used:** Template files in `src/test-lambda/` directory

### **Option 3: Add Layer to Existing Lambda Function**
- ✅ **Use when:** You have an existing Lambda function and want to add tracing
- ✅ **What it does:** Builds layer + adds the custom tracer layer to your existing Lambda
- ✅ **Best for:** Production integration with existing workloads
- ✅ **Files used:** Your existing Lambda function code + layer ARN

## 📚 Next Steps

1. **Customize Anonymization**: Modify patterns in `lumigo-node/src/tracer/tracer.ts`
2. **Add More Spans**: Create detailed tracing for complex operations
3. **Performance Monitoring**: Use spans to identify bottlenecks
4. **Error Tracking**: Enhance error reporting with span attributes

## 📞 Getting Help

If you encounter issues:
1. Check the `TECHNICAL_GUIDE.md` for detailed troubleshooting
2. Verify each step in the build process
3. Check CloudWatch logs for specific error messages
4. Ensure environment variables are set correctly

**Remember**: This process works when followed exactly. Most issues stem from skipping or modifying the build steps.
