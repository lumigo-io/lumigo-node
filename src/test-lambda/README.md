# Test Lambda Function for Custom Lumigo Tracer

This directory contains a test Lambda function to validate the custom Lumigo tracer layer integration.

## Files

- **`index.js`** - Lambda handler with custom tracer integration
- **`package.json`** - Lambda function dependencies
- **`payload.json`** - Test payload with sensitive data for anonymization testing
- **`env-vars.json`** - Environment variables template
- **`env-vars-final.json`** - Environment variables with placeholder token

## Usage

### Deploy the Test Lambda

```bash
# Navigate to the test Lambda directory
cd src/test-lambda

# Update the token in env-vars.json or env-vars-final.json
# Replace "your_lumigo_token_here" with your actual Lumigo token

# Package the Lambda function
zip -r test-lambda.zip .

# Deploy with the custom tracer layer
aws lambda create-function \
  --function-name test-lambda-custom-tracer \
  --runtime nodejs18.x \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://test-lambda.zip \
  --environment file://env-vars.json \
  --timeout 30 \
  --memory-size 128 \
  --layers $LAYER_ARN
```

### Test the Lambda

```bash
# Test with sensitive data
aws lambda invoke \
  --function-name test-lambda-custom-tracer \
  --payload fileb://payload.json response.json && cat response.json
```

### Check Anonymization

```bash
# Get CloudWatch logs to verify anonymization
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/test-lambda-custom-tracer" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text
```

## Expected Behavior

- **Input Event**: Sensitive data should be anonymized in CloudWatch logs
- **Internal Processing**: Data should remain unchanged for processing
- **Response**: Original data should be returned in the response
- **Lumigo Traces**: Spans should be sent to Lumigo with anonymized data

## Clean Up

```bash
# Delete the test Lambda function
aws lambda delete-function --function-name test-lambda-custom-tracer

# Delete the test log group
aws logs delete-log-group --log-group-name "/aws/lambda/test-lambda-custom-tracer"
```
