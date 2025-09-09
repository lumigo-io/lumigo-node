# Setup Guide: Configuring Your Credentials

This guide will help you set up your own credentials and tokens for the Custom Lumigo Tracer project.

## 🔑 **Required Credentials**

### **1. Lumigo Tracer Token**

You need a Lumigo tracer token to send traces to Lumigo. Get this from your Lumigo dashboard:

1. Log into your [Lumigo Dashboard](https://platform.lumigo.io/)
2. Go to **Settings** → **API TOKEN**
3. Copy your tracer token (starts with `t_`)

### **2. AWS Credentials**

You need AWS credentials with permissions to:
- Deploy Lambda functions
- Create API Gateway endpoints
- Create CloudFormation stacks
- Write to CloudWatch logs

**Option A: AWS SSO (Recommended)**
```bash
aws sso login
```

**Option B: AWS Access Keys**
```bash
aws configure
```

## 🚀 **Quick Setup**

### **Option A: Interactive Setup (Recommended)**

```bash
./scripts/setup-env.sh
```

This will prompt you for:
- Your Lumigo tracer token
- Whether to enable anonymization
- Custom anonymization patterns (optional)

### **Option B: Manual Setup**

**Step 1: Copy the Template**

```bash
cp deployment-config.env.template deployment-config.env
```

**Step 2: Edit Your Configuration**

Open `deployment-config.env` and replace the placeholder values:

```bash
# Edit the file
nano deployment-config.env
# or
code deployment-config.env
```

Replace `your_lumigo_token_here` with your actual Lumigo token:

```bash
# Example (replace with your actual token)
LUMIGO_TRACER_TOKEN=t_your_actual_token_here
```

### **Step 3: Verify Your Setup**

```bash
# Test AWS credentials
aws sts get-caller-identity

# Verify Lumigo token format (optional)
echo "Your token should start with 't_' and be about 20+ characters long"
```

### **Step 4: Deploy**

```bash
./deploy.sh
```

## 🔒 **Security Best Practices**

### **Never Commit Sensitive Files**

The following files contain sensitive information and are automatically excluded from git:

- `deployment-config.env` - Contains your Lumigo token
- `local.env` - Contains local environment variables
- `.env*` - Environment files

### **Verify .gitignore**

Make sure these files are in your `.gitignore`:

```gitignore
# Environment files
.env
.env.local
.env.*.local
deployment-config.env
local.env
```

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

## 📞 **Getting Help**

If you encounter issues:

1. Check the `TECHNICAL_GUIDE.md` for detailed troubleshooting
2. Verify your credentials are correctly configured
3. Check CloudWatch logs for specific error messages
4. Ensure all required permissions are granted

## ✅ **Verification Checklist**

Before deploying, verify:

- [ ] `deployment-config.env` exists and contains your actual Lumigo token
- [ ] AWS credentials are configured and working
- [ ] No sensitive information is committed to git
- [ ] `.gitignore` excludes sensitive files
- [ ] You can run `aws sts get-caller-identity` successfully

**Remember**: Never commit your actual credentials to version control!
