# Quickstart Guide: Custom Lumigo Tracer with Anonymization

This guide will walk you through setting up a custom Lumigo tracer with built-in data anonymization and adding manual tracing to your existing Lambda functions.

## 🚀 **Quick Start Overview**

1. **Setup Custom Tracer** - Build and deploy the custom Lumigo tracer with anonymization
2. **Add Manual Tracing** - Integrate manual tracing into your existing Lambda functions
3. **Test & Verify** - Ensure everything works correctly

## 📋 **Prerequisites**

- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- SAM CLI installed (`brew install aws-sam-cli` on macOS)
- Access to a Lumigo account with tracer token

## 🔧 **Step 1: Setup Custom Anonymization Tracer**

### **1.1 Clone and Prepare Repository**

```bash
git clone <your-repo-url>
cd lumigo-tracer-custom
```

### **1.2 Configure Environment Variables**

Edit `deployment-config.env` with your Lumigo token:

```bash
# Lumigo Configuration
LUMIGO_TRACER_TOKEN=your_lumigo_token_here
LUMIGO_ANONYMIZE_ENABLED=true

# Anonymization Patterns (current working configuration)
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]'

# Data Schema for Anonymization (truncation-based for reliability)
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"}, {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"}]'
```

### **1.3 Deploy Everything with One Command**

```bash
# Deploy everything automatically
./deploy.sh
```

This script will:
- ✅ Build the custom tracer with anonymization
- ✅ Handle npm dependency conflicts automatically
- ✅ Deploy to AWS Lambda with API Gateway
- ✅ Configure environment variables correctly
- ✅ Provide testing instructions

### **1.4 Verify Deployment**

The script will output the API Gateway URL and testing instructions. Check CloudWatch logs for:
- ✅ **"🔒 ANONYMIZATION: Return value anonymized for Lumigo traces"**
- ✅ **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ **"Tracer ended"** with **"totalSpans":2**

## 🔍 **Step 2: Add Manual Tracing to Your Lambda**

### **2.1 Basic Manual Tracing Setup**

Create a new Lambda function or modify existing one:

```javascript
// handler.js
const lumigo = require('./lumigo-node');

// Initialize the custom tracer with anonymization
const tracer = lumigo.initTracer({
    token: process.env.LUMIGO_TRACER_TOKEN,
    debug: true
});

// Your existing Lambda handler
async function myHandler(event, context) {
    // Manual span creation
    const span = lumigo.startSpan('custom-operation');
    
    try {
        // Your business logic here
        const result = await processData(event);
        
        // Add custom attributes to span
        span.setAttribute('operation.type', 'data-processing');
        span.setAttribute('operation.result', 'success');
        span.setAttribute('data.size', JSON.stringify(event).length);
        
        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    } catch (error) {
        // Record error in span
        span.recordException(error);
        span.setAttribute('operation.result', 'error');
        span.setAttribute('error.message', error.message);
        
        throw error;
    } finally {
        // Always end the span
        span.end();
    }
}

// Export with Lumigo tracing
exports.handler = tracer.trace(myHandler);
```

### **2.2 Advanced Manual Tracing with Multiple Spans**

```javascript
// handler-advanced.js
const lumigo = require('./lumigo-node');

// Initialize the custom tracer with anonymization
const tracer = lumigo.initTracer({
    token: process.env.LUMIGO_TRACER_TOKEN,
    debug: true
});

async function advancedHandler(event, context) {
    // Root span for the entire operation
    const rootSpan = lumigo.startSpan('user-registration');
    
    try {
        // Validate input
        const validationSpan = lumigo.startSpan('input-validation');
        const validatedData = await validateInput(event);
        validationSpan.setAttribute('validation.result', 'success');
        validationSpan.setAttribute('validation.fields', Object.keys(validatedData).length);
        validationSpan.end();
        
        // Process user data
        const processingSpan = lumigo.startSpan('user-processing');
        const user = await createUser(validatedData);
        processingSpan.setAttribute('user.id', user.id);
        processingSpan.setAttribute('user.email', user.email);
        processingSpan.end();
        
        // Send welcome email
        const emailSpan = lumigo.startSpan('welcome-email');
        await sendWelcomeEmail(user.email);
        emailSpan.setAttribute('email.sent', true);
        emailSpan.setAttribute('email.recipient', user.email);
        emailSpan.end();
        
        rootSpan.setAttribute('operation.completed', true);
        rootSpan.setAttribute('user.created', user.id);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ userId: user.id, message: 'User created successfully' })
        };
        
    } catch (error) {
        rootSpan.recordException(error);
        rootSpan.setAttribute('operation.failed', true);
        rootSpan.setAttribute('error.type', error.name);
        
        throw error;
    } finally {
        rootSpan.end();
    }
}

exports.handler = tracer.trace(advancedHandler);
```

### **2.3 Manual Tracing with Custom Attributes and Events**

```javascript
// handler-detailed.js
const lumigo = require('./lumigo-node');

// Initialize the custom tracer with anonymization
const tracer = lumigo.initTracer({
    token: process.env.LUMIGO_TRACER_TOKEN,
    debug: true
});

async function detailedHandler(event, context) {
    const span = lumigo.startSpan('order-processing');
    
    // Set span attributes
    span.setAttribute('order.id', event.orderId);
    span.setAttribute('customer.id', event.customerId);
    span.setAttribute('order.total', event.total);
    span.setAttribute('order.currency', event.currency);
    
    // Add custom events to the span
    span.addEvent('order.received', {
        'order.timestamp': new Date().toISOString(),
        'order.source': event.source || 'api'
    });
    
    try {
        // Process order
        const order = await processOrder(event);
        
        span.addEvent('order.processed', {
            'order.status': order.status,
            'order.processed_at': new Date().toISOString()
        });
        
        // Update inventory
        const inventorySpan = lumigo.startSpan('inventory-update');
        await updateInventory(order.items);
        inventorySpan.setAttribute('items.updated', order.items.length);
        inventorySpan.end();
        
        span.addEvent('order.completed', {
            'order.completed_at': new Date().toISOString(),
            'order.final_status': 'completed'
        });
        
        return { success: true, orderId: order.id };
        
    } catch (error) {
        span.recordException(error);
        span.addEvent('order.failed', {
            'error.message': error.message,
            'error.stack': error.stack
        });
        throw error;
    } finally {
        span.end();
    }
}

exports.handler = tracer.trace(detailedHandler);
```

## ⚙️ **Step 3: Environment Configuration**

### **3.1 Lambda Environment Variables**

Set these in your Lambda function configuration (or use `deployment-config.env`):

```bash
# Required
LUMIGO_TRACER_TOKEN=your_lumigo_token_here

# Anonymization (current working configuration)
LUMIGO_ANONYMIZE_ENABLED=true
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]'
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"}, {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"}]'
```

### **3.2 SAM Template Configuration**

```yaml
# template.yaml
Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: nodejs18.x
      Handler: handler.handler
      Environment:
        Variables:
          LUMIGO_TRACER_TOKEN: !Ref LumigoToken
          LUMIGO_ANONYMIZE_ENABLED: "true"
          LUMIGO_ANONYMIZE_REGEX: '["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]'
          LUMIGO_ANONYMIZE_DATA_SCHEMA: '[{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"}, {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"}]'
```

## 🧪 **Step 4: Testing and Verification**

### **4.1 Test Your Lambda Function**

```bash
# Test with sample data
aws lambda invoke \
  --function-name your-function-name \
  --payload '{"orderId": "12345", "customerId": "67890", "total": 99.99, "currency": "USD"}' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check the response
cat response.json
```

### **4.2 Verify CloudWatch Logs**

```bash
# Get log group name
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/your-function-name"

# Get latest log stream
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/your-function-name" \
  --order-by LastEventTime \
  --descending \
  --max-items 1

# Get log events
aws logs get-log-events \
  --log-group-name "/aws/lambda/your-function-name" \
  --log-stream-name "your-log-stream-name"
```

### **4.3 Check Lumigo Dashboard**

1. Go to your Lumigo dashboard
2. Look for traces from your Lambda function
3. Verify that:
   - Custom spans are visible
   - Sensitive data is anonymized (truncated or replaced with `[ANONYMIZED]`)
   - Custom attributes and events are present
   - Spans show **"status":200** indicating successful transmission

## 🔄 **Step 5: Integration with Existing Code**

### **5.1 Minimal Integration (Recommended)**

```javascript
// Minimal change to existing handler
const lumigo = require('./lumigo-node');

// Initialize the custom tracer with anonymization
const tracer = lumigo.initTracer({
    token: process.env.LUMIGO_TRACER_TOKEN,
    debug: true
});

// Your existing handler function
async function existingHandler(event, context) {
    // Add manual tracing here
    const span = lumigo.startSpan('business-logic');
    
    try {
        // Your existing code here
        const result = await yourExistingFunction(event);
        
        span.setAttribute('operation.result', 'success');
        return result;
    } catch (error) {
        span.recordException(error);
        throw error;
    } finally {
        span.end();
    }
}

// Wrap with Lumigo (only change needed)
exports.handler = tracer.trace(existingHandler);
```

### **5.2 Gradual Integration**

```javascript
// Start with basic tracing, add more later
const lumigo = require('./lumigo-node');

// Initialize the custom tracer with anonymization
const tracer = lumigo.initTracer({
    token: process.env.LUMIGO_TRACER_TOKEN,
    debug: true
});

async function gradualHandler(event, context) {
    // Phase 1: Basic operation span
    const operationSpan = lumigo.startSpan('main-operation');
    
    try {
        // Your existing business logic
        const result = await processBusinessLogic(event);
        
        // Phase 2: Add sub-operation spans later
        // const subSpan = lumigo.startSpan('sub-operation');
        // ... sub-operation logic
        // subSpan.end();
        
        operationSpan.setAttribute('operation.completed', true);
        return result;
        
    } catch (error) {
        operationSpan.recordException(error);
        throw error;
    } finally {
        operationSpan.end();
    }
}

exports.handler = tracer.trace(gradualHandler);
```

## 🚨 **Troubleshooting**

### **Common Issues and Solutions**

1. **AWS SSO Token Expired**
   - **Cause**: AWS credentials have expired
   - **Solution**: Run `aws sso login` to refresh credentials

2. **npm Dependency Conflicts**
   - **Cause**: Conflicting package versions during build
   - **Solution**: The `./deploy.sh` script handles this automatically with `--legacy-peer-deps`

3. **JSON Parsing Errors in Logs**
   - **Cause**: Malformed JSON in environment variables
   - **Solution**: Check that `deployment-config.env` has properly quoted JSON strings

4. **"Cannot find module './lumigo-node'"**
   - **Cause**: Built tracer not copied to deployment directory
   - **Solution**: The `./deploy.sh` script handles this automatically

5. **No spans appearing in Lumigo**
   - **Cause**: Invalid tracer token or network issues
   - **Solution**: Verify `LUMIGO_TRACER_TOKEN` is correct in `deployment-config.env`

6. **Anonymization not working**
   - **Cause**: Custom code not included in build or environment variables not set
   - **Solution**: Check CloudWatch logs for **"🔒 ANONYMIZATION: Return value anonymized"**

### **Debug Commands**

```bash
# Check if custom code is built
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js

# Check for ES6 imports (should return nothing)
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js

# Verify deployment package
ls -la deployment/eventProcessor-deploy/lumigo-node/

# Check CloudWatch logs for anonymization
aws logs get-log-events --log-group-name "/aws/lambda/eventProcessor" --log-stream-name "LATEST" | grep -E "(ANONYMIZATION|🔒|Spans sent)"
```

## 📚 **Next Steps**

1. **Customize Anonymization**: Modify patterns in `lumigo-node/src/tracer/tracer.ts`
2. **Add More Spans**: Create detailed tracing for complex operations
3. **Performance Monitoring**: Use spans to identify bottlenecks
4. **Error Tracking**: Enhance error reporting with span attributes

## 🎯 **Success Checklist**

- ✅ Custom tracer builds without errors
- ✅ Babel conversion completes successfully
- ✅ Lambda deploys and runs without module errors
- ✅ Manual spans appear in Lumigo dashboard
- ✅ Sensitive data is anonymized in traces (truncated or `[ANONYMIZED]`)
- ✅ Original data preserved in Lambda logs
- ✅ CloudWatch logs show **"🔒 ANONYMIZATION: Return value anonymized"**
- ✅ CloudWatch logs show **"Spans sent [Xms, Y spans]"** with **"status":200**

## 📞 **Getting Help**

If you encounter issues:
1. Check the `WORKING_PROCESS.md` for detailed troubleshooting
2. Verify each step in the build process
3. Check CloudWatch logs for specific error messages
4. Ensure environment variables are set correctly

**Remember**: This process works when followed exactly. Most issues stem from skipping or modifying the build steps.
