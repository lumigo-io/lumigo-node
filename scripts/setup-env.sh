#!/bin/bash

# Setup environment configuration for Custom Lumigo Tracer
set -e

echo "🔧 Setting up environment configuration for Custom Lumigo Tracer..."
echo ""

# Check if config file already exists
if [ -f "deployment-config.env" ]; then
    echo "📁 Found existing deployment-config.env file"
    echo "Current contents:"
    cat deployment-config.env
    echo ""
    
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Updating deployment-config.env..."
    else
        echo "Keeping existing deployment-config.env"
        exit 0
    fi
fi

# Check if local config exists with a real token
if [ -f "deployment-config.env.local" ]; then
    LOCAL_TOKEN=$(grep "LUMIGO_TRACER_TOKEN=" deployment-config.env.local | cut -d'=' -f2)
    if [[ $LOCAL_TOKEN =~ ^t_[a-zA-Z0-9]+$ ]]; then
        echo "🔑 Found existing token in deployment-config.env.local: $LOCAL_TOKEN"
        read -p "Use this token? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            LUMIGO_TRACER_TOKEN=$LOCAL_TOKEN
        else
            echo ""
            echo "🔑 Please enter your Lumigo tracer token:"
            echo "   (Get this from your Lumigo dashboard: Settings → Tracing → Tracer Tokens)"
            read LUMIGO_TRACER_TOKEN
            echo ""
        fi
    else
        echo ""
        echo "🔑 Please enter your Lumigo tracer token:"
        echo "   (Get this from your Lumigo dashboard: Settings → Tracing → Tracer Tokens)"
        read LUMIGO_TRACER_TOKEN
        echo ""
    fi
else
    echo ""
    echo "🔑 Please enter your Lumigo tracer token:"
    echo "   (Get this from your Lumigo dashboard: Settings → Tracing → Tracer Tokens)"
    read LUMIGO_TRACER_TOKEN
    echo ""
fi

# Validate token format
if [[ ! $LUMIGO_TRACER_TOKEN =~ ^t_[a-zA-Z0-9]+$ ]]; then
    echo "⚠️  Warning: Token doesn't match expected format (should start with 't_')"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

echo ""
echo "🔒 Enable data anonymization? (y/n):"
read -p "Default: y " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    LUMIGO_ANONYMIZE_ENABLED=false
else
    LUMIGO_ANONYMIZE_ENABLED=true
fi

echo ""
echo "📝 Configure anonymization patterns? (y/n):"
read -p "Default: n (use defaults) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enter custom regex patterns (comma-separated, or press Enter for defaults):"
    echo "Example: ssn,credit.*card,phone,email"
    read CUSTOM_PATTERNS
    
    if [ -n "$CUSTOM_PATTERNS" ]; then
        # Convert comma-separated to JSON array
        IFS=',' read -ra PATTERNS <<< "$CUSTOM_PATTERNS"
        LUMIGO_ANONYMIZE_REGEX='['
        for i in "${!PATTERNS[@]}"; do
            if [ $i -gt 0 ]; then
                LUMIGO_ANONYMIZE_REGEX+=','
            fi
            LUMIGO_ANONYMIZE_REGEX+="\"${PATTERNS[i]}\""
        done
        LUMIGO_ANONYMIZE_REGEX+=']'
    else
        LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", ".*ip.*", ".*ipv6.*", "address", "zip.*code", "date.*of.*birth", "session.*token", "auth.*token"]'
    fi
else
    LUMIGO_ANONYMIZE_REGEX='["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", ".*ip.*", ".*ipv6.*", "address", "zip.*code", "date.*of.*birth", "session.*token", "auth.*token"]'
fi

# Create the configuration file
cat > deployment-config.env << EOF
# Lumigo Configuration
LUMIGO_TRACER_TOKEN=$LUMIGO_TRACER_TOKEN
LUMIGO_ANONYMIZE_ENABLED=$LUMIGO_ANONYMIZE_ENABLED

        # Anonymization Patterns
        LUMIGO_ANONYMIZE_REGEX='$LUMIGO_ANONYMIZE_REGEX'

        # Data Schema for Anonymization - Multiple types supported
        LUMIGO_ANONYMIZE_DATA_SCHEMA='[{"field": "ssn", "type": "partial", "keep": 5}, {"field": "credit.*card", "type": "truncate", "maxChars": 16, "position": "end"}, {"field": "phone", "type": "truncate", "maxChars": 8, "position": "end"}, {"field": "email", "type": "truncate", "maxChars": 10, "position": "end"}, {"field": ".*ip.*", "type": "partial", "keep": 2, "separator": "."}, {"field": ".*ipv6.*", "type": "partial", "keep": 2, "separator": ":"}, {"field": "address", "type": "truncate", "maxChars": 20, "position": "end"}, {"field": "session.*token", "type": "partial", "keep": 8}, {"field": "auth.*token", "type": "partial", "keep": 8}]'
EOF

echo ""
echo "✅ Environment configuration created successfully!"
echo "📁 Configuration file: deployment-config.env"
echo ""
echo "🔑 Lumigo token: $LUMIGO_TRACER_TOKEN"
echo "🔒 Anonymization enabled: $LUMIGO_ANONYMIZE_ENABLED"
echo "📝 Anonymization patterns: $LUMIGO_ANONYMIZE_REGEX"
echo ""
echo "You can now run:"
echo "  ./deploy.sh"
echo ""
echo "Or edit deployment-config.env manually if you need to make changes."
