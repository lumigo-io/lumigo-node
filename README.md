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

### 2. Deploy Everything

```bash
# Deploy everything with one command
./deploy.sh
```

This script will:
- ✅ Build the custom tracer with anonymization
- ✅ Handle npm dependency conflicts automatically
- ✅ Deploy to AWS Lambda with API Gateway
- ✅ Configure environment variables correctly
- ✅ Provide testing instructions

### 3. Test the Deployment

The script will output the API Gateway URL. Test with:

```bash
curl -X POST https://bea2wba4f8.execute-api.us-east-1.amazonaws.com/Prod/process \
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
        "ip_address": "192.168.1.100",
        "session_token": "sess_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
        "auth_token": "auth_zyx987wvu654tsr321qpo098nml765kji432hgf109edc876baz",
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
        "home_address": "456 Oak Avenue, Springfield, IL 62701"
      }
    }
  }' | jq .
```

### 3b. Test IPv6 Address Anonymization

```bash
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
