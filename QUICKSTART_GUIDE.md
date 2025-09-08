# Quickstart Guide: Custom Lumigo Tracer with Anonymization

This guide will walk you through setting up a custom Lumigo tracer with built-in data anonymization and testing it with the included example Lambda function.

## 🚀 **Quick Start Overview**

1. **Setup Custom Tracer** - Build and deploy the custom Lumigo tracer with anonymization
2. **Test Example Lambda** - Test the included `lambdasAnonymous` Lambda function
3. **Verify Anonymization** - Ensure sensitive data is properly anonymized

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

### **1.4 Alternative: Manual Build (If Automated Fails)**

If the automated deployment fails due to missing dependencies, use this manual process:

```bash
# 1. Build the tracer
cd lumigo-node
npm run build 2>/dev/null || npx tsc --build --force
npx babel dist --out-dir dist --extensions .js --source-maps

# 2. Copy built files to deployment
cd ..
cp -r lumigo-node/dist/* deployment/lambdasAnonymous-deploy/lumigo-node/
cp -r lumigo-node/package.json deployment/lambdasAnonymous-deploy/lumigo-node/

# 3. Copy essential dependencies
mkdir -p deployment/lambdasAnonymous-deploy/lumigo-node/node_modules
cp -r lumigo-node/node_modules/@lumigo deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/debug deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/ms deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/agentkeepalive deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/depd deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r lumigo-node/node_modules/aws-sdk deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/

# 4. Deploy
cd deployment/lambdasAnonymous-deploy
sam build
sam deploy --no-confirm-changeset
```

### **1.5 Verify Deployment**

The script will output the API Gateway URL and testing instructions. Check CloudWatch logs for:
- ✅ **"🔒 ANONYMIZATION: Return value anonymized for Lumigo traces"**
- ✅ **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ **"Tracer ended"** with **"totalSpans":2**

## 🔍 **Step 2: Test the Example Lambda Function**

### **2.1 Test the Deployed Lambda**

The deployment script will provide you with an API Gateway URL. Test it with:

```bash
curl -X POST https://YOUR_API_GATEWAY_URL/Prod/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_registration",
    "data": {
      "user": {
        "id": "123",
        "name": "John Doe",
        "email": "john@example.com",
        "ssn": "123-45-6789",
        "phone": "(555) 123-4567",
        "address": "123 Main St, Anytown, USA",
        "credit_card": "4111-1111-1111-1111",
        "bank_account": "1234567890",
        "driver_license": "DL123456789",
        "passport_number": "P123456789",
        "date_of_birth": "1990-01-01",
        "ip_address": "192.168.1.1",
        "session_token": "sess_abc123def456",
        "auth_token": "auth_xyz789"
      }
    }
  }'
```

### **2.2 Verify Anonymization**

Check CloudWatch logs to verify that anonymization is working:

```bash
# Get the latest log stream
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/lambdasAnonymous" \
  --order-by LastEventTime \
  --descending \
  --max-items 1

# Get log events and look for anonymization messages
aws logs get-log-events \
  --log-group-name "/aws/lambda/lambdasAnonymous" \
  --log-stream-name "YOUR_LOG_STREAM_NAME" | grep -E "(ANONYMIZATION|🔒|Spans sent)"
```

You should see:
- ✅ **"🔒 ANONYMIZATION: Return value anonymized for Lumigo traces"**
- ✅ **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ **"Tracer ended"** with **"totalSpans":2**

## ⚙️ **Step 3: Environment Configuration**

The deployment script automatically configures all necessary environment variables. The configuration is defined in `deployment-config.env`:

```bash
# Lumigo Configuration
LUMIGO_TRACER_TOKEN=your_lumigo_token_here
LUMIGO_ANONYMIZE_ENABLED=true

# Anonymization Patterns (current working configuration)
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address", "session.*token", "auth.*token"]'

# Data Schema for Anonymization (truncation-based for reliability)
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "name", "type": "truncate", "maxChars": 8, "position": "middle"}, {"field": "session_token", "type": "truncate", "maxChars": 20, "position": "beginning"}, {"field": "auth_token", "type": "truncate", "maxChars": 20, "position": "beginning"}]'
```

## 🧪 **Step 4: Testing and Verification**

### **4.1 Test the Example Lambda**

The deployment script provides the API Gateway URL. Test with:

```bash
curl -X POST https://YOUR_API_GATEWAY_URL/Prod/process \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_registration",
    "data": {
      "user": {
        "id": "123",
        "name": "John Doe",
        "email": "john@example.com",
        "ssn": "123-45-6789",
        "phone": "(555) 123-4567",
        "address": "123 Main St, Anytown, USA",
        "credit_card": "4111-1111-1111-1111",
        "bank_account": "1234567890",
        "driver_license": "DL123456789",
        "passport_number": "P123456789",
        "date_of_birth": "1990-01-01",
        "ip_address": "192.168.1.1",
        "session_token": "sess_abc123def456",
        "auth_token": "auth_xyz789"
      }
    }
  }'
```

### **4.2 Verify CloudWatch Logs**

```bash
# Get latest log stream
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/lambdasAnonymous" \
  --order-by LastEventTime \
  --descending \
  --max-items 1

# Get log events
aws logs get-log-events \
  --log-group-name "/aws/lambda/lambdasAnonymous" \
  --log-stream-name "YOUR_LOG_STREAM_NAME"
```

### **4.3 Check Lumigo Dashboard**

1. Go to your Lumigo dashboard
2. Look for traces from the `lambdasAnonymous` Lambda function
3. Verify that:
   - Sensitive data is anonymized (truncated or replaced with `[ANONYMIZED]`)
   - Spans show **"status":200** indicating successful transmission
   - Original data is preserved in CloudWatch logs for debugging



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

5. **"Cannot find module '@lumigo/node-core'" or similar dependency errors**
   - **Cause**: Missing dependencies in deployment package
   - **Solution**: Use the manual build process in section 1.4 above

6. **Babel configuration errors**
   - **Cause**: Missing `.babelrc` file
   - **Solution**: Create it manually: `echo '{"presets": ["@babel/preset-env"], "plugins": ["@babel/plugin-proposal-decorators", {"decoratorsBeforeExport": true}]}' > src/lumigo-tracer/.babelrc`

7. **No spans appearing in Lumigo**
   - **Cause**: Invalid tracer token or network issues
   - **Solution**: Verify `LUMIGO_TRACER_TOKEN` is correct in `deployment-config.env`

8. **Anonymization not working**
   - **Cause**: Custom code not included in build or environment variables not set
   - **Solution**: Check CloudWatch logs for **"🔒 ANONYMIZATION: Return value anonymized"**

### **Debug Commands**

```bash
# Check if custom code is built
grep -n "LUMIGO_ANONYMIZE" build/lumigo-node/tracer/tracer.js

# Check for ES6 imports (should return nothing)
grep -n "import.*from" build/lumigo-node/tracer/tracer.js

# Verify deployment package
ls -la deployment/lambdasAnonymous-deploy/lumigo-node/

# Check CloudWatch logs for anonymization
aws logs get-log-events --log-group-name "/aws/lambda/lambdasAnonymous" --log-stream-name "LATEST" | grep -E "(ANONYMIZATION|🔒|Spans sent)"
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
- ✅ Sensitive data is anonymized in traces (truncated or `[ANONYMIZED]`)
- ✅ Original data preserved in Lambda logs
- ✅ CloudWatch logs show **"🔒 ANONYMIZATION: Return value anonymized"**
- ✅ CloudWatch logs show **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ Decorators are working for performance monitoring

## 📞 **Getting Help**

If you encounter issues:
1. Check the `WORKING_PROCESS.md` for detailed troubleshooting
2. Verify each step in the build process
3. Check CloudWatch logs for specific error messages
4. Ensure environment variables are set correctly

**Remember**: This process works when followed exactly. Most issues stem from skipping or modifying the build steps.
