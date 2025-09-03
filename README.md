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

## Build and Deployment

The custom tracer is built and deployed using automated scripts:

### **Option 1: Full Automated Deployment (Recommended)**

```bash
# Deploy everything with one command
./deploy.sh
```

This script will:
- Build the custom tracer with anonymization
- Handle npm dependency conflicts
- Deploy to AWS Lambda with API Gateway
- Configure environment variables
- Provide testing instructions

### **Option 2: Manual Build Process**

```bash
# Build custom tracer
./package-tracer.sh lambda

# Deploy manually
cd deployment/lambdasAnonymous-deploy
sam build
sam deploy --no-confirm-changeset
```

## Testing

After deployment, the script will provide the API Gateway URL. Test with:

```bash
curl -X POST https://YOUR_API_GATEWAY_URL/Prod/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_registration",
    "data": {
      "user": {
        "name": "John Smith",
        "email": "john.smith@example.com",
        "ssn": "123-45-6789",
        "phone": "(555) 123-4567",
        "address": "123 Main Street, Anytown, USA 12345",
        "credit_card": "4532 1234 5678 9012",
        "ip_address": "192.168.1.100"
      }
    }
  }'
```

### **Verification**

Check CloudWatch logs for:
- ✅ **"🔒 ANONYMIZATION: Return value anonymized for Lumigo traces"**
- ✅ **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ **"Tracer ended"** with **"totalSpans":2**

The anonymization is working if you see anonymized data in Lumigo traces while original data is preserved in CloudWatch logs.

## Anonymization Rules

The current implementation uses **truncation-based anonymization** for reliability:

- **Address**: Truncated to 20 characters from the end
- **Name**: Truncated to 8 characters from the middle  
- **Session Token**: Truncated to 20 characters from the beginning
- **Auth Token**: Truncated to 20 characters from the beginning
- **Other PII**: Replaced with `[ANONYMIZED]` based on regex patterns

### **Current Configuration**

The anonymization is configured via environment variables in `deployment-config.env`:

```bash
LUMIGO_ANONYMIZE_ENABLED=true
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]'
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"}, {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"}]'
```

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
