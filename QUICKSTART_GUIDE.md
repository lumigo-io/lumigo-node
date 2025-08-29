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

### **1.2 Fix TypeScript Compilation Issues**

The TypeScript compilation fails due to decorator issues. Fix this temporarily:

```bash
cd lumigo-node

# Backup problematic files
cp src/hooks/baseHttp.ts src/hooks/baseHttp.ts.backup
cp src/hooks/http.ts src/hooks/http.ts.backup

# Comment out problematic decorators
sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' src/hooks/baseHttp.ts
sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' src/hooks/http.ts
```

### **1.3 Build Custom Tracer**

```bash
# Install dependencies
npm install --legacy-peer-deps

# Build with TypeScript
npm run build

# Convert ES6 modules to CommonJS (CRITICAL for Lambda)
npx babel dist --out-dir dist --extensions .js --source-maps
```

### **1.4 Verify Build Success**

```bash
# Check that anonymization code is present
grep -n "LUMIGO_ANONYMIZE" dist/tracer/tracer.js

# Check that no ES6 imports remain
grep -n "import.*from" dist/tracer/tracer.js  # Should return nothing
```

### **1.5 Deploy to AWS**

```bash
cd ../deployment/eventProcessor-deploy

# Copy built tracer
cp -R ../lumigo-node/dist ./lumigo-node/
cp ../lumigo-node/package.json ./lumigo-node/

# Build and deploy
sam build
sam deploy --no-confirm-changeset
```

## 🔍 **Step 2: Add Manual Tracing to Your Lambda**

### **2.1 Basic Manual Tracing Setup**

Create a new Lambda function or modify existing one:

```javascript
// handler.js
const lumigo = require('./lumigo-node/dist');

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
exports.handler = lumigo.trace(myHandler);
```

### **2.2 Advanced Manual Tracing with Multiple Spans**

```javascript
// handler-advanced.js
const lumigo = require('./lumigo-node/dist');

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

exports.handler = lumigo.trace(advancedHandler);
```

### **2.3 Manual Tracing with Custom Attributes and Events**

```javascript
// handler-detailed.js
const lumigo = require('./lumigo-node/dist');

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

exports.handler = lumigo.trace(detailedHandler);
```

## ⚙️ **Step 3: Environment Configuration**

### **3.1 Lambda Environment Variables**

Set these in your Lambda function configuration:

```bash
# Required
LUMIGO_TRACER_TOKEN=your_lumigo_token_here

# Anonymization (optional)
LUMIGO_ANONYMIZE_ENABLED=true
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "phone", "email", "address"]'
LUMIGO_ANONYMIZE_DATA_SCHEMA='[
  {"field": "ssn", "type": "pattern", "pattern": "(\\d{3})-(\\d{2})-\\d{4}", "replacement": "$1-$2-****"},
  {"field": "credit_card", "type": "pattern", "pattern": "(\\d{4})[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}", "replacement": "$1 **** **** ****"},
  {"field": "phone", "type": "pattern", "pattern": "\\((\\d{3})\\) (\\d{3})-\\d{4}", "replacement": "($1) $2-****"},
  {"field": "email", "type": "pattern", "pattern": "^([^@]{2})[^@]*@", "replacement": "$1***@"}
]'
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
          LUMIGO_ANONYMIZE_REGEX: '["ssn", "credit.*card", "phone", "email"]'
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
   - Sensitive data is anonymized
   - Custom attributes and events are present

## 🔄 **Step 5: Integration with Existing Code**

### **5.1 Minimal Integration (Recommended)**

```javascript
// Minimal change to existing handler
const lumigo = require('./lumigo-node/dist');

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
exports.handler = lumigo.trace(existingHandler);
```

### **5.2 Gradual Integration**

```javascript
// Start with basic tracing, add more later
const lumigo = require('./lumigo-node/dist');

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

exports.handler = lumigo.trace(gradualHandler);
```

## 🚨 **Troubleshooting**

### **Common Issues and Solutions**

1. **"Cannot use import statement outside a module"**
   - **Cause**: Babel conversion step was skipped
   - **Solution**: Run `npx babel dist --out-dir dist --extensions .js --source-maps`

2. **"Cannot find module './lumigo-node/dist'"**
   - **Cause**: Built tracer not copied to deployment directory
   - **Solution**: Copy `dist` directory and `package.json` to deployment

3. **No spans appearing in Lumigo**
   - **Cause**: Invalid tracer token or network issues
   - **Solution**: Verify `LUMIGO_TRACER_TOKEN` is correct

4. **Anonymization not working**
   - **Cause**: Custom code not included in build
   - **Solution**: Verify with `grep -n "LUMIGO_ANONYMIZE" dist/tracer/tracer.js`

### **Debug Commands**

```bash
# Check if custom code is built
grep -n "LUMIGO_ANONYMIZE" lumigo-node/dist/tracer/tracer.js

# Check for ES6 imports
grep -n "import.*from" lumigo-node/dist/tracer/tracer.js

# Verify deployment package
ls -la lumigo-node/dist/tracer/
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
- ✅ Sensitive data is anonymized in traces
- ✅ Original data preserved in Lambda logs

## 📞 **Getting Help**

If you encounter issues:
1. Check the `WORKING_PROCESS.md` for detailed troubleshooting
2. Verify each step in the build process
3. Check CloudWatch logs for specific error messages
4. Ensure environment variables are set correctly

**Remember**: This process works when followed exactly. Most issues stem from skipping or modifying the build steps.
