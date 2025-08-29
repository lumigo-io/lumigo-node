# Lumigo Tracer Custom Anonymization

This project demonstrates how to inject custom data anonymization logic directly into Lumigo's tracer to anonymize sensitive data before it's sent to Lumigo.

## Overview

Instead of trying to intercept Lumigo's tracer from the outside, this approach injects anonymization logic directly into Lumigo's internal `TracerGlobals.setHandlerInputs` function. This ensures that:

1. **Lumigo's tracer works normally** - All tracing functionality is preserved
2. **Data is anonymized before processing** - Sensitive data is replaced with realistic fake data
3. **Traces are sent to Lumigo** - The anonymized data appears in Lumigo's traces

## How It Works

1. **Module Loading**: When the Lambda function loads, it immediately attempts to inject anonymization logic
2. **TracerGlobals Injection**: It waits for `global.TracerGlobals.setHandlerInputs` to become available
3. **Function Wrapping**: It wraps the original `setHandlerInputs` function with anonymization logic
4. **Data Processing**: When Lumigo calls `setHandlerInputs`, our anonymization function processes the data first
5. **Original Call**: The original Lumigo function is called with anonymized data

## Files

- **`functions/requestUnicorn-standalone.js`** - The main Lambda function with anonymization injection
- **`deployment/deploy-standalone-requestUnicorn.sh`** - Deployment script
- **`test-payload-comprehensive.json`** - Test payload with sensitive data

## Environment Variables

- **`LUMIGO_ENABLE_ANONYMIZATION`** - Set to `true` to enable anonymization (default: disabled)
- **`LUMIGO_TRACER_TOKEN`** - Your Lumigo tracer token
- **`LUMIGO_DEBUG`** - Enable Lumigo debug mode

## Deployment

```bash
cd deployment
./deploy-standalone-requestUnicorn.sh
```

## Testing

```bash
aws lambda invoke \
  --function-name wildrydes-barrysolomon-dev-requestUnicorn \
  --payload file://test-payload-comprehensive.json \
  --cli-binary-format raw-in-base64-out \
  --region us-east-1 \
  response-test.json
```

## Anonymization Rules

The anonymization function replaces:

- **Email addresses** - `user123@example.com` → `user456@example.com`
- **SSNs** - `123-45-6789` → `456-78-9012`
- **Phone numbers** - `555-123-4567` → `123-456-7890`
- **Credit cards** - `1234-5678-9012-3456` → `5678-9012-3456-7890`
- **Usernames** - `username: "john"` → `username: "user123"`
- **Secrets** - `secret: "password123"` → `secret: "secret-456"`

## Benefits

- **Minimal code changes** - Only one function needs to be modified
- **Preserves functionality** - All Lumigo features continue to work
- **Real-time processing** - Data is anonymized as it flows through the system
- **Configurable** - Can be enabled/disabled via environment variable
