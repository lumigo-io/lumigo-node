# Lumigo Tracer Custom Anonymization Integration

This project extends the [@lumigo/tracer](https://www.npmjs.com/package/@lumigo/tracer) package with custom data anonymization capabilities for handling PII (Personally Identifiable Information) and sensitive data.

## 🎯 **Goal**

Add a new environment variable `LUMIGO_ANONYMIZE_REGEX` similar to the existing `LUMIGO_SECRET_MASKING_REGEX`, but with enhanced anonymization capabilities that work on both keys and values.

## 🏗️ **Architecture**

### **Core Components**

1. **`lib/anonymizer.js`** - Core anonymization logic
2. **`lib/lumigo-anonymizer-wrapper.js`** - Integration wrapper for Lumigo tracer
3. **Updated Lambda function** - Demonstrates usage

### **Key Features**

- **Regex-based anonymization** - Custom patterns for keys and values
- **Default PII patterns** - Built-in patterns for common sensitive data
- **Environment variable configuration** - Easy deployment configuration
- **Non-destructive** - Original data preserved, anonymized copies created
- **Recursive processing** - Handles nested objects and arrays

## 🔧 **Environment Variables**

### **Required**
```bash
LUMIGO_TRACER_TOKEN=your_lumigo_token
```

### **Optional (Anonymization)**
```bash
LUMIGO_ANONYMIZE_ENABLED=true
LUMIGO_ANONYMIZE_REGEX=["ssn", "credit.*card", "bank.*account", "phone", "email", "address"]
```

## 📦 **Integration with @lumigo/tracer**

### **Current Implementation**
The current implementation wraps the Lumigo tracer to add anonymization:

```javascript
const lumigo = require('@lumigo/tracer');
const LumigoAnonymizerWrapper = require('./lib/lumigo-anonymizer-wrapper');

// Create the tracer instance
const lumigoTracer = lumigo();

// Create the anonymizer wrapper
const tracer = new LumigoAnonymizerWrapper(lumigoTracer, {
    enabled: true,
    anonymizeRegex: ['ssn', 'credit.*card', 'phone']
});

// Export the handler wrapped with anonymization
exports.handler = tracer.trace(myHandler);
```

### **Desired Integration**
To integrate this directly into the `@lumigo/tracer` package, the following changes would be needed:

#### **1. Package.json Updates**
```json
{
  "name": "@lumigo/tracer",
  "version": "2.0.0",
  "dependencies": {
    // ... existing dependencies
  },
  "env": {
    "LUMIGO_ANONYMIZE_REGEX": "Array of regex patterns for anonymization",
    "LUMIGO_ANONYMIZE_ENABLED": "Enable/disable anonymization (default: true)"
  }
}
```

#### **2. Core Tracer Integration**
```javascript
// In the main tracer file
class LumigoTracer {
    constructor(options = {}) {
        // ... existing initialization
        
        // Initialize anonymization
        this.anonymizer = new DataAnonymizer(
            process.env.LUMIGO_ANONYMIZE_REGEX ? 
            JSON.parse(process.env.LUMIGO_ANONYMIZE_REGEX) : 
            []
        );
        
        this.anonymizationEnabled = process.env.LUMIGO_ANONYMIZE_ENABLED !== 'false';
    }
    
    trace(handler) {
        if (!this.anonymizationEnabled) {
            return this.originalTrace(handler);
        }
        
        return this.originalTrace(async (event, context) => {
            // Anonymize incoming event
            const anonymizedEvent = this.anonymizer.anonymizeEvent(event);
            
            // Call handler with anonymized event
            const result = await handler(anonymizedEvent, context);
            
            // Anonymize response
            return this.anonymizer.anonymizeResponse(result);
        });
    }
}
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
./deployment/deploy-eventProcessor.sh <LUMIGO_TOKEN>

# Test the deployed endpoint
curl -X POST https://your-api-gateway-url/Prod/process \
  -H "Content-Type: application/json" \
  -d @test-eventProcessor-payload.json
```

## 📊 **Anonymization Patterns**

### **Default Patterns**
The module includes built-in patterns for common PII:

- `password` → `[PASSWORD]`
- `ssn|social.*security` → `[SSN]`
- `credit.*card|cc.*number` → `[CREDIT_CARD]`
- `bank.*account|account.*number` → `[BANK_ACCOUNT]`
- `driver.*license|license.*number` → `[DRIVER_LICENSE]`
- `passport.*number` → `[PASSPORT]`
- `phone|telephone` → `[PHONE]`
- `email` → `[EMAIL]`
- `address` → `[ADDRESS]`
- `zip.*code|postal.*code` → `[ZIP_CODE]`
- `date.*of.*birth|birth.*date` → `[DOB]`
- `ip.*address` → `[IP_ADDRESS]`

### **Custom Patterns**
Add your own patterns via environment variable:

```bash
LUMIGO_ANONYMIZE_REGEX='["api.*key", "auth.*token", "session.*secret", "custom.*pattern"]'
```

## 🚀 **Deployment**

### **1. Update Lambda Function**
```bash
cp functions/eventProcessor.js deployment/eventProcessor-deploy/
```

### **2. Update Environment Variables**
```bash
# In template.yaml or environment configuration
LUMIGO_ANONYMIZE_ENABLED: "true"
LUMIGO_ANONYMIZE_REGEX: '["ssn", "credit.*card", "phone", "email"]'
```

### **3. Deploy**
```bash
cd deployment/eventProcessor-deploy
sam build && sam deploy
```

## 🔍 **Monitoring & Verification**

### **CloudWatch Logs**
Look for anonymization messages:
```
Lumigo Anonymizer Wrapper initialized: { customPatterns: 0, defaultPatterns: 13, totalPatterns: 13 }
Loaded 11 custom anonymization patterns from environment
Anonymization enabled: true
```

### **Lumigo Dashboard**
- Check that sensitive data appears as `[ANONYMIZED]` or specific tags
- Verify that PII is not visible in traces
- Monitor anonymization statistics

## 📝 **Contributing to @lumigo/tracer**

To contribute this anonymization feature to the main Lumigo tracer package:

1. **Fork the repository**: https://github.com/lumigo-io/lumigo-node-tracer
2. **Add the anonymization module** to the core package
3. **Update the main tracer class** to support anonymization
4. **Add environment variable support** for configuration
5. **Update documentation** and examples
6. **Submit a pull request**

## 🔐 **Security Considerations**

- **Environment Variables**: Store regex patterns securely
- **Pattern Validation**: Validate regex patterns to prevent injection attacks
- **Data Handling**: Ensure original data is not logged or stored
- **Compliance**: Verify anonymization meets your compliance requirements

## 📚 **References**

- [Lumigo Tracer Documentation](https://docs.lumigo.io/docs/nodejs)
- [@lumigo/tracer NPM Package](https://www.npmjs.com/package/@lumigo/tracer)
- [Lumigo GitHub Repository](https://github.com/lumigo-io/lumigo-node-tracer)
- [AWS Lambda Environment Variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
