# Lumigo Tracer Custom Anonymization Integration

This project extends the [@lumigo/tracer](https://www.npmjs.com/package/@lumigo/tracer) package with custom data anonymization capabilities by modifying the core source code and building a custom version.

## 🎉 **Status: WORKING**

✅ **Successfully deployed and tested** - The custom tracer with anonymization is working perfectly!  
✅ **Spans are being sent** to Lumigo with status 200  
✅ **PII data is anonymized** in Lumigo traces  
✅ **Original data preserved** in CloudWatch logs for debugging  
✅ **Automated deployment** with `./deploy.sh` script

## 🎯 **Goal**

Add custom data anonymization logic directly into the core Lumigo tracer to anonymize sensitive data before it's sent to Lumigo, while preserving original data in Lambda logs for debugging.

## 🏗️ **Architecture**

### **Core Components**

1. **`lumigo-node/src/tracer/tracer.ts`** - Modified core Lumigo tracer with embedded anonymization logic
2. **`deployment/lambdasAnonymous-deploy/lambdasAnonymous.js`** - Lambda handler using the custom tracer
3. **`./deploy.sh`** - Automated deployment script (recommended)
4. **`./package-tracer.sh`** - Alternative packaging script for different deployment types
5. **`deployment-config.env`** - Configuration file for Lumigo token and anonymization settings

### **Key Features**

- **Built-in anonymization** - Anonymization logic is part of the core tracer
- **Truncation-based anonymization** - Reliable anonymization using truncation strategies
- **Environment variable configuration** - Easy deployment configuration via `deployment-config.env`
- **Non-destructive** - Original data preserved in logs, anonymized data sent to Lumigo
- **Recursive processing** - Handles nested objects and arrays
- **Automated deployment** - One-command deployment with `./deploy.sh`
- **JSON parsing error handling** - Robust error handling for malformed configuration

## 🔧 **Environment Variables**

### **Required**
```bash
LUMIGO_TRACER_TOKEN=your_lumigo_token
```

### **Optional (Anonymization) - Current Working Configuration**
```bash
LUMIGO_ANONYMIZE_ENABLED=true
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]'
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"}, {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"}]'
```

**Note**: The current implementation uses truncation-based anonymization for reliability. Complex regex patterns were causing JSON parsing errors, so they were simplified to ensure stable operation.

## 📦 **Integration Approach**

### **Source Code Modification**
Instead of wrapping the tracer, we modify the core source code in `lumigo-node/src/tracer/tracer.ts`:

```typescript
// In processUserHandler function
let anonymizedEvent = event;
if (process.env['LUMIGO_ANONYMIZE_ENABLED'] === 'true') {
  try {
    const patterns = JSON.parse(process.env['LUMIGO_ANONYMIZE_REGEX'] || '[]');
    const dataSpecificPatterns = JSON.parse(process.env['LUMIGO_ANONYMIZE_DATA_SCHEMA'] || '[]');
    
    if (patterns && patterns.length > 0) {
      // Apply custom anonymization logic
      anonymizedEvent = anonymizeValue(event);
    }
  } catch (e) {
    logger.warn('Failed to apply anonymization:', e);
  }
}

// Set anonymized event for Lumigo tracing
TracerGlobals.setHandlerInputs({ event: anonymizedEvent, context });

// Call user handler with ORIGINAL event
const pUserHandler = promisifyUserHandler(userHandler, event, context, responseStream);
```

### **Build Process**
The custom tracer is built and deployed using automated scripts:

#### **Option 1: Automated Deployment (Recommended)**
```bash
# Deploy everything with one command
./deploy.sh
```

This script automatically:
- Builds the custom tracer with anonymization
- Handles npm dependency conflicts
- Deploys to AWS Lambda with API Gateway
- Configures environment variables
- Provides testing instructions

#### **Option 2: Manual Build Process**
```bash
# Build custom tracer
./package-tracer.sh lambda

# Deploy manually
cd deployment/lambdasAnonymous-deploy
sam build
sam deploy --no-confirm-changeset
```

## 🧪 **Testing**

### **Automated Testing**
```bash
# Deploy and test with one command
./deploy.sh
```

The script will provide the API Gateway URL and testing instructions.

### **Manual Testing**
```bash
# Test the deployed endpoint
curl -X POST https://your-api-gateway-url/Prod/process \
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

## 📊 **Anonymization Patterns**

### **Current Working Strategies**

1. **Truncation-based Anonymization** (Primary method):
   - **Address**: Truncated to 20 characters from the end
   - **Name**: Truncated to 8 characters from the middle
   - **Session Token**: Truncated to 20 characters from the beginning
   - **Auth Token**: Truncated to 20 characters from the beginning

2. **Pattern-based Replacement** (Fallback):
   - **Other PII**: Replaced with `[ANONYMIZED]` based on regex patterns
   - **SSN, Credit Card, Phone, Email, etc.**: All replaced with `[ANONYMIZED]`

**Note**: Complex regex patterns with replacements were causing JSON parsing errors, so the current implementation prioritizes reliable truncation-based anonymization.

### **Current Working Patterns**
The module includes built-in patterns for common PII:

- `ssn|social.*security` → `[ANONYMIZED]`
- `credit.*card|cc.*number` → `[ANONYMIZED]`
- `bank.*account|account.*number` → `[ANONYMIZED]`
- `driver.*license|license.*number` → `[ANONYMIZED]`
- `passport.*number` → `[ANONYMIZED]`
- `phone|telephone` → `[ANONYMIZED]`
- `email` → `[ANONYMIZED]`
- `address` → Truncated to 20 characters from end
- `zip.*code|postal.*code` → `[ANONYMIZED]`
- `date.*of.*birth|birth.*date` → `[ANONYMIZED]`
- `ip.*address` → `[ANONYMIZED]`
- `session.*token` → Truncated to 20 characters from beginning
- `auth.*token` → Truncated to 20 characters from beginning

## 🚀 **Deployment**

### **1. Automated Deployment (Recommended)**
```bash
# Deploy everything with one command
./deploy.sh
```

This script automatically:
- Builds the custom tracer with anonymization
- Handles npm dependency conflicts
- Deploys to AWS Lambda with API Gateway
- Configures environment variables
- Provides testing instructions

### **2. Manual Deployment**
```bash
# Build custom tracer
./package-tracer.sh lambda

# Deploy Lambda function
cd deployment/lambdasAnonymous-deploy
sam build && sam deploy --no-confirm-changeset
```

### **3. Verify Deployment**
```bash
# Check that custom code is included
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js

# Check that no ES6 imports remain
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js  # Should return nothing

# Check CloudWatch logs for successful anonymization
aws logs get-log-events --log-group-name "/aws/lambda/lambdasAnonymous" --log-stream-name "LATEST" | grep -E "(ANONYMIZATION|🔒|Spans sent)"
```

## 🔍 **Monitoring & Verification**

### **CloudWatch Logs**
Look for anonymization messages:
```
🔒 ANONYMIZATION: Return value anonymized for Lumigo traces
Spans sent [Xms, Y spans] with status:200
Tracer ended with totalSpans:2
```

### **Lumigo Dashboard**
- Check that sensitive data appears with truncation patterns or `[ANONYMIZED]`
- Verify that PII is not visible in traces
- Monitor anonymization statistics
- Confirm spans show **"status":200** indicating successful transmission

## 🔐 **Security Considerations**

- **Environment Variables**: Store regex patterns securely
- **Pattern Validation**: Validate regex patterns to prevent injection attacks
- **Data Handling**: Ensure original data is not sent to external services
- **Compliance**: Verify anonymization meets your compliance requirements
- **Logging**: Original data is preserved in Lambda logs for debugging

## 🚨 **Troubleshooting**

### **Common Issues**

1. **AWS SSO Token Expired**: Run `aws sso login` to refresh credentials
2. **npm Dependency Conflicts**: The `./deploy.sh` script handles this automatically with `--legacy-peer-deps`
3. **JSON Parsing Errors**: Check that environment variables are properly quoted in `deployment-config.env`
4. **Module Not Found**: Verify the deploy script completed successfully
5. **Anonymization not working**: Check CloudWatch logs for **"🔒 ANONYMIZATION: Return value anonymized"**

### **Build Verification**

The deploy script automatically verifies the build:

```bash
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js  # Should return nothing
```

### **Deployment Verification**

Check CloudWatch logs for successful execution:
- ✅ **"🔒 ANONYMIZATION: Return value anonymized for Lumigo traces"**
- ✅ **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ **"Tracer ended"** with **"totalSpans":2**
- ❌ **"Failed to anonymize return value"** (indicates an issue)

## 📚 **References**

- [Lumigo Tracer Documentation](https://docs.lumigo.io/docs/nodejs)
- [@lumigo/tracer NPM Package](https://www.npmjs.com/package/@lumigo/tracer)
- [Lumigo GitHub Repository](https://github.com/lumigo-io/lumigo-node-tracer)
- [AWS Lambda Environment Variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
- [TypeScript Compilation](https://www.typescriptlang.org/docs/)
- [Babel Transpilation](https://babeljs.io/docs/)
