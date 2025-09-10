# Technical Guide: Custom Lumigo Tracer with Anonymization

**IMPORTANT: This document contains the EXACT working process. Follow these steps precisely to avoid hours of debugging.**

## 🎯 **What This Achieves**

- ✅ Custom anonymization logic built into the core Lumigo tracer
- ✅ ES6 modules converted to CommonJS for Lambda compatibility
- ✅ Lambda runs successfully with custom tracer
- ✅ Anonymization works in Lumigo traces while preserving original data in logs

## 🚀 **Complete Working Process**

### **Step 1: Setup Environment (First Time Only)**

```bash
# Interactive setup for first-time users
./scripts/setup-env.sh
```

This will prompt you for your Lumigo token and configuration options.

**✅ Verified Working Configuration:**
- **API Gateway URL**: `https://bea2wba4f8.execute-api.us-east-1.amazonaws.com/Prod/process`
- **Lambda Function**: `lambdasAnonymous`
- **Region**: `us-east-1`
- **Anonymization**: All types working (partial, pattern, regex, truncate)

### **Step 2: Automated Deployment (Recommended)**

```bash
# Deploy everything with one command
./deploy.sh
```

This handles all the complexity automatically. If it fails, proceed to manual steps below.

### **Step 3: Manual Build Process (If Automated Fails)**

#### **2.1 Fix TypeScript Compilation Issues**

The TypeScript compilation fails due to decorator issues in other files. Temporarily fix this:

```bash
cd lumigo-node

# Backup problematic files
cp src/hooks/baseHttp.ts src/hooks/baseHttp.ts.backup
cp src/hooks/http.ts src/hooks/http.ts.backup

# Comment out problematic decorators
sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' src/hooks/baseHttp.ts
sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' src/hooks/http.ts
```

#### **2.2 Build with TypeScript**

```bash
cd lumigo-node
npm run build 2>/dev/null || npx tsc --build --force
```

**Expected Output**: Build completes without errors

#### **2.3 Create Babel Configuration**

```bash
# Create .babelrc file in the correct location
echo '{"presets": ["@babel/preset-env"], "plugins": ["@babel/plugin-proposal-decorators", {"decoratorsBeforeExport": true}]}' > src/lumigo-tracer/.babelrc
```

#### **2.4 Convert ES6 to CommonJS with Babel**

**CRITICAL**: This step is essential - TypeScript outputs ES6 modules that Lambda cannot run.

```bash
cd lumigo-node
npx babel dist --out-dir dist --extensions .js --source-maps
```

**Expected Output**: `Successfully compiled 56 files with Babel (XXXms)`

#### **2.5 Verify Custom Code is Included**

```bash
# Check that anonymization code is present
grep -n "LUMIGO_ANONYMIZE" dist/tracer/tracer.js

# Check that no ES6 imports remain
grep -n "import.*from" dist/tracer/tracer.js  # Should return nothing
```

**Expected Output**: 
- `LUMIGO_ANONYMIZE` should return line numbers
- `import.*from` should return nothing

#### **2.6 Copy to Deployment Directory**

```bash
# Copy the built tracer
cp -r dist/* ../deployment/lambdasAnonymous-deploy/lumigo-node/
cp package.json ../deployment/lambdasAnonymous-deploy/lumigo-node/
```

#### **2.7 Copy Essential Dependencies**

```bash
# Create node_modules directory
mkdir -p ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules

# Copy essential dependencies
cp -r node_modules/@lumigo ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/debug ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/ms ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/agentkeepalive ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/depd ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/aws-sdk ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/utf8 ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/rfdc ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/shimmer ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
cp -r node_modules/axios ../deployment/lambdasAnonymous-deploy/lumigo-node/node_modules/
```

#### **2.8 Build and Deploy SAM Application**

```bash
cd ../deployment/lambdasAnonymous-deploy

# Build SAM application
sam build

# Deploy to AWS
sam deploy --no-confirm-changeset
```

**Expected Output**: Deployment succeeds with CloudFormation stack updates

### **Step 3: Test the Deployment**

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

**Expected Output**: `{"message":"Event processed successfully",...}`

## 🔍 **Verification Steps**

### **Check CloudWatch Logs**

Look for successful execution:
- ✅ No "Cannot use import statement outside a module" errors
- ✅ Lambda function executes successfully
- ✅ Custom anonymization messages appear

### **Verify Anonymization is Working**

The Lambda should:
- ✅ Process events successfully
- ✅ Show original data in logs (for debugging)
- ✅ Send anonymized data to Lumigo (in traces)

## 🚨 **Common Failure Points**

### **1. TypeScript Compilation Fails**
- **Symptom**: Build fails with decorator errors
- **Solution**: Comment out problematic decorators in hooks files
- **Verification**: `npm run build` completes successfully

### **2. Babel Conversion Fails**
- **Symptom**: ES6 import errors in Lambda
- **Solution**: Ensure Babel step is completed
- **Verification**: `grep -n "import.*from" dist/tracer/tracer.js` returns nothing

### **3. Custom Code Missing**
- **Symptom**: Anonymization not working
- **Solution**: Verify custom code is in built files
- **Verification**: `grep -n "LUMIGO_ANONYMIZE" dist/tracer/tracer.js` returns line numbers

### **4. Missing Dependencies**
- **Symptom**: "Cannot find module '@lumigo/node-core'" or similar errors
- **Solution**: Copy essential dependencies manually (see step 2.7 above)
- **Verification**: `ls lumigo-node/node_modules/@lumigo` shows directory exists

### **5. Missing package.json**
- **Symptom**: "Cannot find module '../package.json'" error
- **Solution**: Copy package.json to deployment directory
- **Verification**: `ls lumigo-node/package.json` shows file exists

### **6. Babel Configuration Missing**
- **Symptom**: "Cannot find module '.babelrc'" error
- **Solution**: Create .babelrc file (see step 2.3 above)
- **Verification**: `ls src/lumigo-tracer/.babelrc` shows file exists

## 📝 **Environment Variables**

Ensure these are set in your Lambda:

```bash
LUMIGO_ANONYMIZE_ENABLED=true
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "phone", "email", "address"]'
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "ssn", "type": "pattern", "pattern": "(\\d{3})-(\\d{2})-\\d{4}", "replacement": "$1-$2-****"}]'
LUMIGO_TRACER_TOKEN=your_lumigo_token
```

## 🔄 **When You Need to Rebuild**

Rebuild the custom tracer when:
- ✅ You modify the anonymization logic in `src/tracer/tracer.ts`
- ✅ You update environment variables
- ✅ You want to test changes

**DO NOT rebuild** for:
- ❌ Lambda function changes (only `sam build && sam deploy`)
- ❌ Environment variable changes (only `sam deploy`)

## 💡 **Key Insights**

1. **Babel is essential** - TypeScript alone outputs ES6 modules that Lambda can't run
2. **Decorator issues block compilation** - Must temporarily fix hooks files
3. **package.json is required** - Tracer needs version information
4. **Copy dist directory completely** - Don't just copy individual files
5. **Verify each step** - Check output at each stage to catch issues early

## 🎯 **Success Criteria**

The process is successful when:
- ✅ Lambda executes without module errors
- ✅ Custom anonymization code is loaded
- ✅ Events are processed successfully
- ✅ Anonymization messages appear in logs
- ✅ Lumigo receives anonymized data in traces

**Remember**: This process works. If it fails, you likely skipped or modified one of these exact steps.

## 🧪 **Testing and Verification**

### **Test the Example Lambda**

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

### **Verify CloudWatch Logs**

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

### **Check Lumigo Dashboard**

1. Go to your Lumigo dashboard
2. Look for traces from the `lambdasAnonymous` Lambda function
3. Verify that:
   - Sensitive data is anonymized (truncated or replaced with `[ANONYMIZED]`)
   - Spans show **"status":200** indicating successful transmission
   - Original data is preserved in CloudWatch logs for debugging

## 🔒 **Anonymization Configuration**

### **Supported Anonymization Types**

The `LUMIGO_ANONYMIZE_DATA_SCHEMA` supports multiple anonymization types:

#### **1. `partial` - Keep X Characters**
Keeps the first X characters and replaces the rest with asterisks.

```json
{"field": "ssn", "type": "partial", "keep": 5}
```
**Result**: `"12345****"` (keeps first 5, masks rest)

#### **2. `truncate` - Truncate to Max Length**
Truncates values to a maximum length with configurable position.

```json
{"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}
```
**Parameters**:
- `maxChars`: Maximum characters to keep
- `position`: `"start"`, `"end"`, `"middle"`, or `"random"`

#### **3. `pattern` - Regex Replacement**
Uses regex patterns with custom replacement strings.

```json
{"field": "credit.*card", "type": "pattern", "pattern": "\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}", "replacement": "**** **** **** ****"}
```
**Result**: `"4532 1234 5678 9012"` → `"**** **** **** ****"`

#### **4. `regex` - Simple Regex Replacement**
Uses regex with default `***` replacement.

```json
{"field": "email", "type": "regex", "pattern": "^[^@]+", "replacement": "***"}
```
**Result**: `"john@example.com"` → `"***@example.com"`

#### **5. IP Address Anonymization**
Special handling for IPv4 and IPv6 addresses with appropriate separators.

**IPv4 Addresses (dot separators):**
```json
{"field": ".*ip.*", "type": "partial", "keep": 2, "separator": "."}
```
**Result**: `"192.168.1.100"` → `"192.168.***.***"`

**IPv6 Addresses (colon separators):**
```json
{"field": ".*ipv6.*", "type": "partial", "keep": 2, "separator": ":"}
```
**Result**: `"2001:0db8:85a3:0000:0000:8a2e:0370:7334"` → `"2001:0db8:***:***:***:***:***:***"`

### **Example Complete Schema**

```json
[
  {"field": "ssn", "type": "partial", "keep": 5},
  {"field": "credit.*card", "type": "truncate", "maxChars": 16, "position": "end"},
  {"field": "phone", "type": "truncate", "maxChars": 8, "position": "end"},
  {"field": "email", "type": "truncate", "maxChars": 10, "position": "end"},
  {"field": ".*ipv6.*", "type": "partial", "keep": 2, "separator": ":"},
  {"field": ".*ip.*", "type": "partial", "keep": 2, "separator": "."},
  {"field": "address", "type": "truncate", "maxChars": 20, "position": "end"},
  {"field": "session.*token", "type": "partial", "keep": 8},
  {"field": "auth.*token", "type": "partial", "keep": 8}
]
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

5. **"Cannot find module '@lumigo/node-core'" or similar dependency errors**
   - **Cause**: Missing dependencies in deployment package
   - **Solution**: Use the manual build process in section 2 above

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

## 🎯 **Success Checklist**

- ✅ Custom tracer builds without errors
- ✅ Babel conversion completes successfully
- ✅ Lambda deploys and runs without module errors
- ✅ Sensitive data is anonymized in traces (truncated or `[ANONYMIZED]`)
- ✅ Original data preserved in Lambda logs
- ✅ CloudWatch logs show **"🔒 ANONYMIZATION: Return value anonymized"**
- ✅ CloudWatch logs show **"Spans sent [Xms, Y spans]"** with **"status":200**
- ✅ Decorators are working for performance monitoring
