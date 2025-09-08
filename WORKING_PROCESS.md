# Working Process - Custom Lumigo Tracer with Anonymization

**IMPORTANT: This document contains the EXACT working process. Follow these steps precisely to avoid hours of debugging.**

## 🎯 **What This Achieves**

- ✅ Custom anonymization logic built into the core Lumigo tracer
- ✅ ES6 modules converted to CommonJS for Lambda compatibility
- ✅ Lambda runs successfully with custom tracer
- ✅ Anonymization works in Lumigo traces while preserving original data in logs

## 🚀 **Complete Working Process**

### **Step 1: Automated Deployment (Recommended)**

```bash
# Deploy everything with one command
./deploy.sh
```

This handles all the complexity automatically. If it fails, proceed to manual steps below.

### **Step 2: Manual Build Process (If Automated Fails)**

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
