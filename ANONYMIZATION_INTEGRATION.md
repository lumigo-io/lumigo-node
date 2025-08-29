# Lumigo Tracer Custom Anonymization Integration

This project extends the [@lumigo/tracer](https://www.npmjs.com/package/@lumigo/tracer) package with custom data anonymization capabilities by modifying the core source code and building a custom version.

## 🎯 **Goal**

Add custom data anonymization logic directly into the core Lumigo tracer to anonymize sensitive data before it's sent to Lumigo, while preserving original data in Lambda logs for debugging.

## 🏗️ **Architecture**

### **Core Components**

1. **`lumigo-node/src/tracer/tracer.ts`** - Modified core Lumigo tracer with embedded anonymization logic
2. **`deployment/eventProcessor-deploy/eventProcessor.js`** - Lambda handler using the custom tracer
3. **`build-lumigo-tracer.sh`** - Build script for the custom tracer

### **Key Features**

- **Built-in anonymization** - Anonymization logic is part of the core tracer
- **Regex-based patterns** - Custom patterns for keys and values
- **Environment variable configuration** - Easy deployment configuration
- **Non-destructive** - Original data preserved in logs, anonymized data sent to Lumigo
- **Recursive processing** - Handles nested objects and arrays
- **Multiple anonymization strategies** - Pattern replacement, truncation, partial masking

## 🔧 **Environment Variables**

### **Required**
```bash
LUMIGO_TRACER_TOKEN=your_lumigo_token
```

### **Optional (Anonymization)**
```bash
LUMIGO_ANONYMIZE_ENABLED=true
LUMIGO_ANONYMIZE_REGEX=["ssn", "credit.*card", "bank.*account", "phone", "email", "address"]
LUMIGO_ANONYMIZE_DATA_SCHEMA='[
  {"field": "address", "type": "truncate", "maxChars": 20, "position": "end"},
  {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"},
  {"field": "ssn", "type": "pattern", "pattern": "(\\d{3})-(\\d{2})-\\d{4}", "replacement": "$1-$2-****"},
  {"field": "credit_card", "type": "pattern", "pattern": "(\\d{4})[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}", "replacement": "$1 **** **** ****"},
  {"field": "phone", "type": "pattern", "pattern": "\\((\\d{3})\\) (\\d{3})-\\d{4}", "replacement": "($1) $2-****"},
  {"field": "email", "type": "pattern", "pattern": "^([^@]{2})[^@]*@", "replacement": "$1***@"},
  {"field": "ip_address", "type": "pattern", "pattern": "(\\d{1,3}\\.\\d{1,3})\\.\\d{1,3}\\.\\d{1,3}", "replacement": "$1.***.***"}
]'
```

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

## 🧪 **Testing**

### **Local Testing**
```bash
# Test the anonymization module
node test-anonymization.js

# Test with SAM locally
./deployment/test-eventProcessor-local.sh
```

### **AWS Testing**
```bash
# Deploy with anonymization enabled
cd deployment/eventProcessor-deploy
sam build && sam deploy --no-confirm-changeset

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

## 📊 **Anonymization Patterns**

### **Supported Strategies**

1. **Pattern Replacement**: Use regex patterns with replacements
   - SSN: `123-45-6789` → `123-45-****`
   - Credit Card: `4532 1234 5678 9012` → `4532 **** **** ****`

2. **Truncation**: Keep specified characters and mask the rest
   - Address: `123 Main Street, Anytown, USA 12345` → `123 Main Street, ***`
   - Name: `John Smith` → `Jo*** Sm`

3. **Partial Masking**: Keep specified number of characters
   - Email: `john.smith@example.com` → `jo***@example.com`
   - Phone: `(555) 123-4567` → `(555) 123-****`

4. **Built-in Patterns**: Automatic detection and masking
   - IP Address: `192.168.1.100` → `192.168.***.***`

### **Default Patterns**
The module includes built-in patterns for common PII:

- `ssn|social.*security` → Pattern-based masking
- `credit.*card|cc.*number` → Pattern-based masking
- `bank.*account|account.*number` → Pattern-based masking
- `driver.*license|license.*number` → Pattern-based masking
- `passport.*number` → Pattern-based masking
- `phone|telephone` → Pattern-based masking
- `email` → Pattern-based masking
- `address` → Truncation-based masking
- `zip.*code|postal.*code` → Pattern-based masking
- `date.*of.*birth|birth.*date` → Pattern-based masking
- `ip.*address` → Pattern-based masking

## 🚀 **Deployment**

### **1. Build Custom Tracer**
```bash
./build-lumigo-tracer.sh
```

### **2. Deploy Lambda Function**
```bash
cd deployment/eventProcessor-deploy
sam build && sam deploy --no-confirm-changeset
```

### **3. Verify Deployment**
```bash
# Check that custom code is included
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js

# Check that no ES6 imports remain
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js  # Should return nothing
```

## 🔍 **Monitoring & Verification**

### **CloudWatch Logs**
Look for anonymization messages:
```
Enhanced PII anonymization applied to event for Lumigo tracing
🔒 ANONYMIZATION: Data-specific anonymization applied successfully
🔍 DEBUG: Original event keys: [user, transaction]
🔍 DEBUG: Anonymized event keys: [user, transaction]
```

### **Lumigo Dashboard**
- Check that sensitive data appears with specific masking patterns
- Verify that PII is not visible in traces
- Monitor anonymization statistics

## 🔐 **Security Considerations**

- **Environment Variables**: Store regex patterns securely
- **Pattern Validation**: Validate regex patterns to prevent injection attacks
- **Data Handling**: Ensure original data is not sent to external services
- **Compliance**: Verify anonymization meets your compliance requirements
- **Logging**: Original data is preserved in Lambda logs for debugging

## 🚨 **Troubleshooting**

### **Common Issues**

1. **ES6 Import Errors**: Ensure Babel conversion step is completed
2. **TypeScript Compilation Errors**: Check for decorator issues in hooks files
3. **Missing package.json**: The tracer needs package.json for version information
4. **Module Not Found**: Verify dist directory is copied to deployment package

### **Build Verification**

After building, verify the custom code is included:

```bash
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js  # Should return nothing
```

### **Deployment Verification**

Check CloudWatch logs for successful execution:
- No more "Cannot use import statement outside a module" errors
- Lambda function executes successfully
- Anonymization messages appear in logs

## 📚 **References**

- [Lumigo Tracer Documentation](https://docs.lumigo.io/docs/nodejs)
- [@lumigo/tracer NPM Package](https://www.npmjs.com/package/@lumigo/tracer)
- [Lumigo GitHub Repository](https://github.com/lumigo-io/lumigo-node-tracer)
- [AWS Lambda Environment Variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
- [TypeScript Compilation](https://www.typescriptlang.org/docs/)
- [Babel Transpilation](https://babeljs.io/docs/)
