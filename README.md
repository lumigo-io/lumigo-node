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

- **`lumigo-node/src/tracer/tracer.ts`** - Core Lumigo tracer with embedded anonymization logic
- **`deployment/eventProcessor-deploy/`** - Lambda deployment package
- **`deployment/eventProcessor-deploy/eventProcessor.js`** - Lambda handler
- **`build-lumigo-tracer.sh`** - Build script for the custom tracer

## Environment Variables

- **`LUMIGO_ANONYMIZE_ENABLED`** - Set to `true` to enable anonymization (default: disabled)
- **`LUMIGO_ANONYMIZE_REGEX`** - JSON array of regex patterns to match sensitive fields
- **`LUMIGO_ANONYMIZE_DATA_SCHEMA`** - JSON array defining anonymization rules for specific fields
- **`LUMIGO_TRACER_TOKEN`** - Your Lumigo tracer token

## Build Process

The custom tracer must be built using this exact sequence:

```bash
cd lumigo-node

# 1. Fix TypeScript compilation issues (if any)
# Temporarily comment out problematic decorators in src/hooks/baseHttp.ts and src/hooks/http.ts

# 2. Build with TypeScript
npm run build

# 3. Convert ES6 modules to CommonJS using Babel
npx babel dist --out-dir dist --extensions .js --source-maps

# 4. Copy to deployment directory
cp -R dist ../deployment/eventProcessor-deploy/lumigo-node/

# 5. Include package.json for version info
cp package.json ../deployment/eventProcessor-deploy/lumigo-node/
```

## Deployment

```bash
cd deployment/eventProcessor-deploy

# Build SAM application
sam build

# Deploy to AWS
sam deploy --no-confirm-changeset
```

## Testing

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

## Anonymization Rules

The anonymization logic supports multiple strategies:

- **Pattern Replacement**: Use regex patterns with replacements (e.g., SSN: `123-45-6789` → `123-45-****`)
- **Truncation**: Keep first/last/middle characters and mask the rest
- **Partial Masking**: Keep specified number of characters and mask the rest
- **Built-in Patterns**: Automatic detection and masking of common sensitive data types

## Benefits

- **Built-in functionality** - Anonymization is part of the core tracer
- **Preserves functionality** - All Lumigo features continue to work
- **Real-time processing** - Data is anonymized as it flows through the system
- **Configurable** - Can be enabled/disabled and customized via environment variables
- **Lambda compatible** - CommonJS modules work natively in Lambda

## Troubleshooting

### Common Issues

1. **ES6 Import Errors**: Ensure Babel conversion step is completed
2. **TypeScript Compilation Errors**: Check for decorator issues in hooks files
3. **Missing package.json**: The tracer needs package.json for version information
4. **Module Not Found**: Verify dist directory is copied to deployment package

### Build Verification

After building, verify the custom code is included:

```bash
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js  # Should return nothing
```
