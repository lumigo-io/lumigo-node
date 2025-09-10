#!/bin/bash
# =============================================================================
# 🚀 COMPREHENSIVE LUMIGO ANONYMIZATION TEST SCRIPT
# =============================================================================
# This script performs a complete fresh deployment and tests ALL anonymization
# permutations including IPv4, IPv6, and comprehensive PII data types.
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting Comprehensive Lumigo Anonymization Test..."
echo ""

# =============================================================================
# STEP 1: CLEAN ENVIRONMENT (FRESH START)
# =============================================================================
echo "🧹 Step 1: Cleaning environment..."
rm -rf build/ dist/ deployment/ node_modules/ lumigo-node/node_modules/
rm -f deployment-config.env deployment-config.env.local
echo "✅ Environment cleaned"
echo ""

# =============================================================================
# STEP 2: SETUP ENVIRONMENT CONFIGURATION
# =============================================================================
echo "🔧 Step 2: Setting up environment configuration..."
echo -e "t_f8f7b905da964eef89261\ny\nn\n" | ./scripts/setup-env.sh

# Fix pattern precedence (IPv6 before IPv4)
echo "🔧 Fixing pattern precedence..."
# Create corrected configuration
cat > deployment-config.env << 'EOF'
# Lumigo Configuration
LUMIGO_TRACER_TOKEN=t_f8f7b905da964eef89261
LUMIGO_ANONYMIZE_ENABLED=true

# Anonymization Patterns
LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", ".*ipv6.*", ".*ip.*", "address", "zip.*code", "date.*of.*birth", "session.*token", "auth.*token"]'

# Data Schema for Anonymization - Multiple types supported
LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "ssn", "type": "partial", "keep": 5}, {"field": "credit.*card", "type": "truncate", "maxChars": 16, "position": "end"}, {"field": "phone", "type": "truncate", "maxChars": 8, "position": "end"}, {"field": "email", "type": "truncate", "maxChars": 10, "position": "end"}, {"field": ".*ipv6.*", "type": "partial", "keep": 2, "separator": ":"}, {"field": ".*ip.*", "type": "partial", "keep": 2, "separator": "."}, {"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "session.*token", "type": "partial", "keep": 8}, {"field": "auth.*token", "type": "partial", "keep": 8}]'
EOF

echo "✅ Configuration created and fixed"
echo ""

# =============================================================================
# STEP 3: VERIFY CONFIGURATION
# =============================================================================
echo "📋 Step 3: Verifying configuration..."
cat deployment-config.env
echo ""

# =============================================================================
# STEP 4: DEPLOY APPLICATION
# =============================================================================
echo "🚀 Step 4: Deploying application..."
npm run build && ./deploy.sh
echo ""

# =============================================================================
# STEP 5: GET API GATEWAY URL DYNAMICALLY
# =============================================================================
echo "🔗 Step 5: Getting API Gateway URL..."
API_GATEWAY_ID=$(aws apigateway get-rest-apis --query 'items[?contains(name, `lambdasAnonymous`)].id' --output text)
API_GATEWAY_URL="https://${API_GATEWAY_ID}.execute-api.us-east-1.amazonaws.com/Prod/process"
echo "API Gateway URL: $API_GATEWAY_URL"
echo ""

# =============================================================================
# STEP 6: COMPREHENSIVE ANONYMIZATION TESTING
# =============================================================================
echo "🧪 Step 6: Testing all anonymization permutations..."
echo ""

# Test 1: IPv4 Address Anonymization
echo "🔍 Test 1: IPv4 Address Anonymization"
echo "Expected: 192.168.***.***, 10.0.***.***, 203.0.***.***"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ipv4_test",
    "data": {
      "ip_address": "192.168.1.100",
      "primary_ip": "10.0.0.1",
      "secondary_ip": "203.0.113.1",
      "gateway_ip": "192.168.0.1",
      "dns_ip": "8.8.8.8"
    }
  }' | jq '.eventData'
echo ""

# Test 2: IPv6 Address Anonymization
echo "🔍 Test 2: IPv6 Address Anonymization"
echo "Expected: 2001:0db8:***:***:***:***:***:***, 2001:db8:***:***, fe80::***"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ipv6_test",
    "data": {
      "ipv6_address": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      "ipv6_primary": "2001:db8::1",
      "ipv6_secondary": "fe80::1",
      "ipv6_gateway": "2001:db8::1",
      "ipv6_dns": "2001:4860:4860::8888"
    }
  }' | jq '.eventData'
echo ""

# Test 3: Mixed IP Addresses (IPv4 + IPv6)
echo "🔍 Test 3: Mixed IP Addresses"
echo "Expected: IPv4 with dots, IPv6 with colons"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mixed_ip_test",
    "data": {
      "ipv4_address": "192.168.1.100",
      "ipv6_address": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      "primary_ipv4": "10.0.0.1",
      "primary_ipv6": "2001:db8::1",
      "secondary_ipv4": "203.0.113.1",
      "secondary_ipv6": "fe80::1"
    }
  }' | jq '.eventData'
echo ""

# Test 4: Partial Anonymization (SSN, Tokens)
echo "🔍 Test 4: Partial Anonymization"
echo "Expected: SSN keeps last 5, tokens keep first 8"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "partial_test",
    "data": {
      "ssn": "123-45-6789",
      "session_token": "sess_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
      "auth_token": "auth_zyx987wvu654tsr321qpo098nml765kji432hgf109edc876baz",
      "api_key": "api_1234567890abcdefghijklmnopqrstuvwxyz",
      "access_token": "access_9876543210zyxwvutsrqponmlkjihgfedcba"
    }
  }' | jq '.eventData'
echo ""

# Test 5: Truncation Anonymization
echo "🔍 Test 5: Truncation Anonymization"
echo "Expected: Credit card 16 chars, phone 8 chars, email 10 chars, address 20 chars"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "truncate_test",
    "data": {
      "credit_card": "4532 1234 5678 9012",
      "phone": "(555) 123-4567",
      "email": "john.smith@example.com",
      "address": "123 Main Street, Anytown, USA 12345",
      "credit_card_number": "4532-1234-5678-9012",
      "phone_number": "+1-555-987-6543",
      "email_address": "contact@example.com",
      "home_address": "456 Oak Avenue, Springfield, IL 62701"
    }
  }' | jq '.eventData'
echo ""

# Test 6: Pattern-based Anonymization
echo "🔍 Test 6: Pattern-based Anonymization"
echo "Expected: Driver license, passport, bank account, zip code, date of birth anonymized"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "pattern_test",
    "data": {
      "driver_license": "DL123456789",
      "passport_number": "P123456789",
      "bank_account": "1234567890",
      "zip_code": "12345",
      "date_of_birth": "1990-01-15",
      "license_number": "LIC123456",
      "passport_id": "PASSPORT789",
      "account_number": "ACC987654321"
    }
  }' | jq '.eventData'
echo ""

# Test 7: Comprehensive PII Test (All Types)
echo "🔍 Test 7: Comprehensive PII Test (All Anonymization Types)"
echo "Expected: Mixed anonymization across all data types"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "comprehensive_pii_test",
    "data": {
      "user": {
        "name": "John Smith",
        "email": "john.smith@example.com",
        "ssn": "123-45-6789",
        "phone": "(555) 123-4567",
        "address": "123 Main Street, Anytown, USA 12345",
        "credit_card": "4532 1234 5678 9012",
        "ip_address": "192.168.1.100",
        "ipv6_address": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        "session_token": "sess_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
        "auth_token": "auth_zyx987wvu654tsr321qpo098nml765kji432hgf109edc876baz",
        "driver_license": "DL123456789",
        "passport_number": "P123456789",
        "bank_account": "1234567890",
        "zip_code": "12345",
        "date_of_birth": "1990-01-15"
      },
      "payment": {
        "credit_card_number": "4532-1234-5678-9012",
        "cvv": "123",
        "expiry": "12/25"
      },
      "contact": {
        "email_address": "contact@example.com",
        "phone_number": "+1-555-987-6543",
        "home_address": "456 Oak Avenue, Springfield, IL 62701"
      },
      "network": {
        "primary_ip": "10.0.0.1",
        "secondary_ip": "203.0.113.1",
        "ipv6_primary": "2001:db8::1",
        "ipv6_secondary": "fe80::1"
      }
    }
  }' | jq '.eventData'
echo ""

# Test 8: Edge Cases and Special Characters
echo "🔍 Test 8: Edge Cases and Special Characters"
echo "Expected: Proper handling of special characters and edge cases"
curl -X POST $API_GATEWAY_URL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "edge_cases_test",
    "data": {
      "email_with_plus": "user+tag@example.com",
      "phone_with_ext": "(555) 123-4567 ext 123",
      "address_with_unicode": "123 Main St, São Paulo, Brasil",
      "credit_card_with_spaces": "4532  1234  5678  9012",
      "ssn_with_dashes": "123-45-6789",
      "ssn_without_dashes": "123456789",
      "ipv6_compressed": "2001:db8::1",
      "ipv6_full": "2001:0db8:0000:0000:0000:0000:0000:0001"
    }
  }' | jq '.eventData'
echo ""

# =============================================================================
# STEP 7: VERIFY CLOUDWATCH LOGS
# =============================================================================
echo "📊 Step 7: Checking CloudWatch logs for anonymization activity..."
aws logs filter-log-events \
  --log-group-name "/aws/lambda/lambdasAnonymous" \
  --start-time $(date -d '5 minutes ago' +%s)000 \
  --query 'events[?contains(message, `ANONYMIZATION`) || contains(message, `Spans sent`) || contains(message, `Tracer ended`)].{Time:eventTime,Message:message}' \
  --output table
echo ""

# =============================================================================
# STEP 8: CLEANUP (OPTIONAL)
# =============================================================================
echo "🧹 Step 8: Cleanup (Optional)"
echo "To clean up AWS resources, run:"
echo "  aws cloudformation delete-stack --stack-name lambdasAnonymous-stack"
echo "  aws lambda delete-function --function-name lambdasAnonymous"
echo "  aws apigateway delete-rest-api --rest-api-id $API_GATEWAY_ID"
echo "  aws logs delete-log-group --log-group-name /aws/lambda/lambdasAnonymous"
echo ""

echo "🎉 Comprehensive anonymization test completed!"
echo "✅ All tests executed successfully"
echo "📊 Check the results above to verify anonymization is working correctly"
