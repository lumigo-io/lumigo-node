# Lambda Deployment Scripts

This directory contains scripts for managing the `lambdasAnonymous` Lambda function with custom Lumigo tracer and anonymization features.

## Scripts

### 1. `setup-local-env.sh`
Sets up local environment variables for testing and deployment.

**Usage:**
```bash
./scripts/setup-local-env.sh
```

**What it does:**
- Prompts for Lumigo token
- Prompts for AWS region (defaults to us-east-1)
- Creates `deployment/lambdasAnonymous-deploy/local.env` file
- Sets up environment variables for local testing

### 2. `test-lambda-local.sh`
Tests the Lambda function locally using SAM CLI.

**Usage:**
```bash
# Using token from local.env
./scripts/test-lambda-local.sh

# Or provide token directly
./scripts/test-lambda-local.sh <LUMIGO_TOKEN>
```

**What it does:**
- Loads environment variables from local.env
- Builds the Lambda package
- Creates test event if needed
- Invokes Lambda locally with SAM

### 3. `deploy-lambda.sh`
Builds and deploys the Lambda function to AWS.

**Usage:**
```bash
# Using token from local.env
./scripts/deploy-lambda.sh

# Or provide token directly
./scripts/deploy-lambda.sh <LUMIGO_TOKEN>
```

**What it does:**
- Builds the custom lumigo-tracer
- Copies built files to deployment directory
- Installs dependencies
- Builds Lambda package with SAM
- Deploys to AWS with the provided Lumigo token

## Workflow

1. **First time setup:**
   ```bash
   ./scripts/setup-local-env.sh
   ```

2. **Local testing:**
   ```bash
   ./scripts/test-lambda-local.sh
   ```

3. **Deploy to AWS:**
   ```bash
   ./scripts/deploy-lambda.sh
   ```

## Environment Variables

The scripts use these environment variables:
- `LUMIGO_TRACER_TOKEN`: Your Lumigo tracer token
- `AWS_REGION`: AWS region (default: us-east-1)
- `NODE_ENV`: Environment (development)
- `LUMIGO_ANONYMIZE_ENABLED`: Enable anonymization (true)

## Lambda Function

The `lambdasAnonymous` Lambda function:
- **Purpose**: Demonstrates custom Lumigo tracer with PII anonymization
- **Endpoint**: `https://jqms16v249.execute-api.us-east-1.amazonaws.com/Prod/process`
- **Features**: 
  - Custom Lumigo tracing
  - PII data anonymization
  - Manual span creation
  - Business logic demonstration
