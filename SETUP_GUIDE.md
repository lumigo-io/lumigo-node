# Quick Start Guide: Deploy Your First Test Lambda

This guide will walk you through deploying a test Lambda function with the custom Lumigo tracer in just a few minutes.

## 🚀 **Step-by-Step Quick Start**

### **Step 1: Get Your Lumigo Token**

1. Log into your [Lumigo Dashboard](https://platform.lumigo.io/)
2. Go to **Settings** → **API TOKEN**
3. Copy your tracer token (starts with `t_`)

### **Step 2: Set Up AWS Credentials**

**Option A: AWS SSO (Recommended)**
```bash
aws sso login
```

**Option B: AWS Access Keys**
```bash
aws configure
```

**Verify your credentials:**
```bash
aws sts get-caller-identity
```

### **Step 3: Configure Your Environment**

**Create your configuration file:**
```bash
cp deployment-config.env.template deployment-config.env
```

**Edit the configuration:**
```bash
# Edit the file
nano deployment-config.env
# or
code deployment-config.env
```

**Replace the placeholder with your actual Lumigo token:**
```bash
# Example (replace with your actual token)
LUMIGO_TRACER_TOKEN=t_your_actual_token_here
```

### **Step 4: Deploy the Test Lambda**

**Deploy everything with one command:**
```bash
./deploy.sh
```

This will:
- ✅ Build the custom tracer with anonymization
- ✅ Deploy a test Lambda function to AWS
- ✅ Create an API Gateway endpoint
- ✅ Set up all environment variables
- ✅ Provide testing instructions

### **Step 5: Test Your Deployment**

**The deployment script will output your API Gateway URL. Test it with:**

```bash
curl -X POST https://your-api-gateway-url/Prod/process \
  -H "Content-Type: application/json" \
  -d '{"type":"user_registration","data":{"user":{"id":"123","name":"John Doe","email":"john@example.com","ssn":"123-45-6789","phone":"(555) 123-4567","address":"123 Main St, Anytown, USA"}}}'
```

### **Step 6: Verify Anonymization**

**Check CloudWatch logs to see anonymized data:**
```bash
# Get the latest logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/lambdasAnonymous

# View the logs
aws logs get-log-events --log-group-name /aws/lambda/lambdasAnonymous --log-stream-name [latest-stream]
```

**Check Lumigo dashboard:**
- Go to [Lumigo Traces](https://platform.lumigo.io/traces)
- Look for your test traces with anonymized PII data

## 🎉 **You're Done!**

Your test Lambda function is now deployed and running with the custom Lumigo tracer. The sensitive data in your test payload will be anonymized in the traces sent to Lumigo.

## 🚨 **Troubleshooting**

### **"Invalid Lumigo Token" Error**
1. Verify your token is correct in `deployment-config.env`
2. Check that the token starts with `t_`
3. Ensure you have an active Lumigo account

### **"AWS Credentials Not Found" Error**
1. Run `aws sso login` (if using SSO)
2. Or run `aws configure` (if using access keys)
3. Verify with `aws sts get-caller-identity`

### **"Permission Denied" Error**
1. Check your AWS IAM permissions
2. Ensure you have Lambda, API Gateway, and CloudFormation permissions
3. Contact your AWS administrator if needed

## 🔒 **Security Best Practices**

### **Never Commit Sensitive Files**
The following files contain sensitive information and are automatically excluded from git:
- `deployment-config.env` - Contains your Lumigo token
- `local.env` - Contains local environment variables
- `.env*` - Environment files

### **Check for Exposed Credentials**
Before committing, always check for exposed credentials:
```bash
# Search for potential exposed tokens
grep -r "t_[a-zA-Z0-9]" . --exclude-dir=.git --exclude="*.template"
grep -r "sk_[a-zA-Z0-9]" . --exclude-dir=.git --exclude="*.template"
grep -r "AKIA[a-zA-Z0-9]" . --exclude-dir=.git --exclude="*.template"
```

## 🛠️ **Advanced Configuration**

### **Custom Anonymization Patterns**
You can customize what data gets anonymized by modifying the regex patterns in `deployment-config.env`:

```bash
# Example: Add custom patterns
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "custom_field", "another_sensitive_field"]'
```

### **Custom Data Schema**
You can define specific anonymization rules for different field types:

```bash
# Example: Custom truncation rules
LUMIGO_ANONYMIZE_DATA_SCHEMA='[
  {"field": "address", "type": "truncate", "maxChars": 20, "position": "end"},
  {"field": "custom_field", "type": "truncate", "maxChars": 10, "position": "middle"}
]'
```

## 📞 **Next Steps**

Now that you have a working test Lambda, you can:

1. **Explore Layer Integration**: Check out the `README.md` for instructions on using the custom tracer as a Lambda layer
2. **Customize Anonymization**: Modify patterns in `deployment-config.env` to match your needs
3. **Integrate with Existing Lambdas**: Use the layer approach to add tracing to your existing functions

## ✅ **Verification Checklist**

Before deploying, verify:
- [ ] `deployment-config.env` exists and contains your actual Lumigo token
- [ ] AWS credentials are configured and working
- [ ] You can run `aws sts get-caller-identity` successfully

**Remember**: Never commit your actual credentials to version control!
