#!/bin/bash

# Custom Lumigo Tracer Packaging Script
# This script can package the custom tracer in different formats for various deployment scenarios

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PACKAGE_TYPE=""
OUTPUT_DIR="./packages"
CLEAN_BUILD=false
VERBOSE=false
SKIP_TESTS=false
INCLUDE_SOURCE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Custom Lumigo Tracer Packaging Script

USAGE:
    $0 [OPTIONS] <package-type>

PACKAGE TYPES:
    npm          - Create an npm package (tarball)
    lambda       - Create Lambda deployment package
    layer        - Create AWS Lambda Layer package
    docker       - Create Docker image with custom tracer
    all          - Create all package types

OPTIONS:
    -o, --output-dir DIR     Output directory (default: ./packages)
    -c, --clean              Clean build (remove existing dist and node_modules)
    -v, --verbose            Verbose output
    -s, --skip-tests         Skip running tests
    --include-source         Include source files in package
    -h, --help               Show this help message

EXAMPLES:
    $0 npm                           # Create npm package
    $0 lambda -o ./deploy            # Create Lambda package in ./deploy
    $0 layer --clean                 # Create Lambda layer with clean build
    $0 all -v                        # Create all packages with verbose output

EOF
}

# Function to parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -o|--output-dir)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -c|--clean)
                CLEAN_BUILD=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --include-source)
                INCLUDE_SOURCE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            npm|lambda|layer|docker|all)
                if [[ -n "$PACKAGE_TYPE" ]]; then
                    print_error "Multiple package types specified. Please choose only one."
                    exit 1
                fi
                PACKAGE_TYPE="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    if [[ -z "$PACKAGE_TYPE" ]]; then
        print_error "Package type is required"
        show_usage
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "src/lumigo-tracer/package.json" ]]; then
        print_error "src/lumigo-tracer/package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check TypeScript
    if ! command -v npx &> /dev/null; then
        print_error "npx is not available"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to clean build artifacts
clean_build() {
    if [[ "$CLEAN_BUILD" == true ]]; then
        print_status "Cleaning build artifacts..."
        
        # Clean build directory
        rm -rf build/
        
        # Clean source directory
        cd src/lumigo-tracer
        rm -rf dist/ node_modules/ temp-build/ temp-dist/ test-compile/
        cd ../..
        
        # Clean output directory
        rm -rf "$OUTPUT_DIR"
        
        print_success "Build artifacts cleaned"
    fi
}

# Function to fix TypeScript compilation issues
fix_typescript_issues() {
    print_status "Fixing TypeScript compilation issues..."
    
    cd src/lumigo-tracer
    
    # Backup problematic files if they exist
    if [[ -f "hooks/baseHttp.ts" ]]; then
        cp hooks/baseHttp.ts hooks/baseHttp.ts.backup 2>/dev/null || true
    fi
    if [[ -f "hooks/http.ts" ]]; then
        cp hooks/http.ts hooks/http.ts.backup 2>/dev/null || true
    fi
    
    # Comment out problematic decorators
    if [[ -f "hooks/baseHttp.ts" ]]; then
        sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/baseHttp.ts 2>/dev/null || \
        sed -i 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/baseHttp.ts
    fi
    
    if [[ -f "hooks/http.ts" ]]; then
        sed -i '' 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/http.ts 2>/dev/null || \
        sed -i 's/@GlobalDurationTimer.timedSync()/\/\/@GlobalDurationTimer.timedSync()/g' hooks/http.ts
    fi
    
    cd ../..
    print_success "TypeScript issues fixed"
}

# Function to build the custom tracer
build_tracer() {
    print_status "Building custom Lumigo tracer..."
    
    cd src/lumigo-tracer
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm install --legacy-peer-deps
    
    # Build with TypeScript
    print_status "Compiling TypeScript..."
    npm run build
    
    # Convert ES6 modules to CommonJS
    print_status "Converting ES6 modules to CommonJS..."
    npx babel dist --out-dir dist --extensions .js --source-maps
    
    # Copy built files to build directory
    print_status "Copying built files to build directory..."
    mkdir -p ../../build/lumigo-node
    cp -r dist/* ../../build/lumigo-node/
    cp package.json ../../build/lumigo-node/
    
    cd ../..
    print_success "Custom tracer built successfully"
}

# Function to validate the build
validate_build() {
    print_status "Validating build..."
    
    # Check if anonymization code is present
    if ! grep -q "LUMIGO_ANONYMIZE" build/lumigo-node/tracer/tracer.js; then
        print_error "Anonymization code not found in built tracer"
        exit 1
    fi
    
    # Check for ES6 imports (should be none)
    if grep -q "import.*from" build/lumigo-node/tracer/tracer.js; then
        print_error "ES6 imports found in built tracer - Babel conversion failed"
        exit 1
    fi
    
    print_success "Build validation passed"
}

# Function to run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        print_warning "Skipping tests"
        return
    fi
    
    print_status "Running tests..."
    cd src/lumigo-tracer
    npm test
    cd ../..
    print_success "Tests passed"
}

# Function to create output directory
create_output_dir() {
    mkdir -p "$OUTPUT_DIR"
    print_status "Output directory: $OUTPUT_DIR"
}

# Function to create npm package
create_npm_package() {
    print_status "Creating npm package..."
    
    local package_dir="$OUTPUT_DIR/npm-package"
    mkdir -p "$package_dir"
    
    # Copy built tracer
    cp -r build/lumigo-node/* "$package_dir/"
    cp src/lumigo-tracer/README.md "$package_dir/" 2>/dev/null || true
    cp src/lumigo-tracer/LICENSE "$package_dir/" 2>/dev/null || true
    
    # Include source files if requested
    if [[ "$INCLUDE_SOURCE" == true ]]; then
        cp -r src/lumigo-tracer/* "$package_dir/src/"
        cp src/lumigo-tracer/tsconfig.json "$package_dir/" 2>/dev/null || true
    fi
    
    # Create package.json for the custom tracer
    cat > "$package_dir/package.json" << EOF
{
  "name": "@lumigo/tracer-custom",
  "version": "1.108.1-custom",
  "description": "Custom Lumigo Tracer with built-in anonymization",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "test": "echo \"Custom tracer - no tests included\""
  },
  "dependencies": {
    "@lumigo/node-core": "1.17.1",
    "agentkeepalive": "^4.1.4",
    "axios": "^1.11.0",
    "rfdc": "^1.4.1",
    "shimmer": "1.2.1",
    "utf8": "^3.0.0"
  },
  "keywords": [
    "lumigo",
    "tracer",
    "custom",
    "anonymization",
    "lambda",
    "aws"
  ],
  "author": "Lumigo LTD (https://lumigo.io)",
  "license": "Apache-2.0"
}
EOF
    
    # Create tarball
    cd "$package_dir"
    npm pack
    cd - > /dev/null
    
    # Move tarball to output directory
    mv "$package_dir"/*.tgz "$OUTPUT_DIR/"
    rm -rf "$package_dir"
    
    print_success "NPM package created: $OUTPUT_DIR/lumigo-tracer-custom-1.108.1-custom.tgz"
}

# Function to create Lambda deployment package
create_lambda_package() {
    print_status "Creating Lambda deployment package..."
    
    local package_dir="$OUTPUT_DIR/lambda-package"
    mkdir -p "$package_dir"
    
    # Copy built tracer
    cp -r build/lumigo-node "$package_dir/"
    
    # Copy essential dependencies
    print_status "Copying essential dependencies..."
    mkdir -p "$package_dir/lumigo-node/node_modules"
    cp -r src/lumigo-tracer/node_modules/@lumigo "$package_dir/lumigo-node/node_modules/" 2>/dev/null || true
    cp -r src/lumigo-tracer/node_modules/debug "$package_dir/lumigo-node/node_modules/" 2>/dev/null || true
    cp -r src/lumigo-tracer/node_modules/ms "$package_dir/lumigo-node/node_modules/" 2>/dev/null || true
    cp -r src/lumigo-tracer/node_modules/agentkeepalive "$package_dir/lumigo-node/node_modules/" 2>/dev/null || true
    cp -r src/lumigo-tracer/node_modules/depd "$package_dir/lumigo-node/node_modules/" 2>/dev/null || true
    cp -r src/lumigo-tracer/node_modules/aws-sdk "$package_dir/lumigo-node/node_modules/" 2>/dev/null || true
    
    # Create Lambda handler
    cat > "$package_dir/handler.js" << 'EOF'
const lumigo = require('./lumigo-node');

// Initialize the custom Lumigo tracer with anonymization
const tracer = lumigo();

const myHandler = async (event, context) => {
    console.log('Custom Lumigo tracer Lambda started');
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    try {
        const result = {
            message: 'Event processed successfully with custom tracer',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
            event: event
        };
        
        return {
            statusCode: 200,
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    } catch (error) {
        console.error('Error processing event:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                requestId: context.awsRequestId
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};

exports.handler = tracer.trace(myHandler);
EOF
    
    # Create package.json for Lambda
    cat > "$package_dir/package.json" << EOF
{
  "name": "lambda-with-custom-tracer",
  "version": "1.0.0",
  "description": "Lambda function with custom Lumigo tracer",
  "main": "handler.js",
  "dependencies": {
    "@lumigo/node-core": "1.17.1",
    "agentkeepalive": "^4.1.4",
    "axios": "^1.11.0",
    "rfdc": "^1.4.1",
    "shimmer": "1.2.1",
    "utf8": "^3.0.0"
  }
}
EOF
    
    # Install dependencies
    cd "$package_dir"
    npm install --production
    
    # Create zip file
    zip -r "../lambda-package.zip" . -x "*.git*" "*.DS_Store*" "node_modules/.cache/*"
    cd - > /dev/null
    
    print_success "Lambda package created: $OUTPUT_DIR/lambda-package.zip"
}

# Function to create Lambda Layer package
create_layer_package() {
    print_status "Creating Lambda Layer package..."
    
    local package_dir="$OUTPUT_DIR/layer-package"
    mkdir -p "$package_dir/nodejs"
    
    # Copy built tracer to nodejs directory (Lambda Layer structure)
    cp -r build/lumigo-node "$package_dir/nodejs/"
    
    # Create layer package.json
    cat > "$package_dir/nodejs/package.json" << EOF
{
  "name": "lumigo-tracer-custom-layer",
  "version": "1.0.0",
  "description": "Custom Lumigo tracer as Lambda Layer",
  "main": "lumigo-node/index.js"
}
EOF
    
    # Install dependencies
    cd "$package_dir/nodejs"
    npm install --production
    cd - > /dev/null
    
    # Create zip file
    cd "$package_dir"
    zip -r "../layer-package.zip" . -x "*.git*" "*.DS_Store*" "node_modules/.cache/*"
    cd - > /dev/null
    
    print_success "Lambda Layer package created: $OUTPUT_DIR/layer-package.zip"
}

# Function to create Docker image
create_docker_package() {
    print_status "Creating Docker package..."
    
    local package_dir="$OUTPUT_DIR/docker-package"
    mkdir -p "$package_dir"
    
    # Copy built tracer
    cp -r build/lumigo-node "$package_dir/"
    
    # Create Dockerfile
    cat > "$package_dir/Dockerfile" << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy custom tracer
COPY lumigo-node/ ./lumigo-node/

# Install dependencies
WORKDIR /app/lumigo-node
RUN npm install --production

# Create sample application
WORKDIR /app
COPY package.json ./
RUN npm install

COPY app.js ./

EXPOSE 3000

CMD ["node", "app.js"]
EOF
    
    # Create sample application
    cat > "$package_dir/app.js" << 'EOF'
const lumigo = require('./lumigo-node');
const express = require('express');

const tracer = lumigo();
const app = express();

app.use(express.json());

const myHandler = async (req, res) => {
    console.log('Request received:', req.body);
    
    const result = {
        message: 'Request processed with custom Lumigo tracer',
        timestamp: new Date().toISOString(),
        data: req.body
    };
    
    res.json(result);
};

app.post('/process', tracer.trace(myHandler));

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
EOF
    
    # Create package.json for the app
    cat > "$package_dir/package.json" << EOF
{
  "name": "docker-app-with-custom-tracer",
  "version": "1.0.0",
  "description": "Docker application with custom Lumigo tracer",
  "main": "app.js",
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF
    
    # Create docker-compose.yml
    cat > "$package_dir/docker-compose.yml" << 'EOF'
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - LUMIGO_TRACER_TOKEN=${LUMIGO_TRACER_TOKEN}
      - LUMIGO_ANONYMIZE_ENABLED=true
      - LUMIGO_ANONYMIZE_REGEX=["ssn", "credit.*card", "phone", "email"]
    volumes:
      - ./logs:/app/logs
EOF
    
    # Create build script
    cat > "$package_dir/build.sh" << 'EOF'
#!/bin/bash
echo "Building Docker image with custom Lumigo tracer..."
docker build -t lumigo-custom-tracer:latest .
echo "Build complete!"
echo "To run: docker run -p 3000:3000 -e LUMIGO_TRACER_TOKEN=your_token lumigo-custom-tracer:latest"
EOF
    
    chmod +x "$package_dir/build.sh"
    
    print_success "Docker package created: $package_dir/"
    print_status "To build Docker image: cd $package_dir && ./build.sh"
}

# Function to create all packages
create_all_packages() {
    print_status "Creating all package types..."
    create_npm_package
    create_lambda_package
    create_layer_package
    create_docker_package
    print_success "All packages created successfully"
}

# Main function
main() {
    echo "🚀 Custom Lumigo Tracer Packaging Script"
    echo "========================================"
    
    parse_args "$@"
    
    print_status "Starting packaging process..."
    print_status "Package type: $PACKAGE_TYPE"
    print_status "Output directory: $OUTPUT_DIR"
    
    check_prerequisites
    clean_build
    fix_typescript_issues
    build_tracer
    validate_build
    run_tests
    create_output_dir
    
    case "$PACKAGE_TYPE" in
        npm)
            create_npm_package
            ;;
        lambda)
            create_lambda_package
            ;;
        layer)
            create_layer_package
            ;;
        docker)
            create_docker_package
            ;;
        all)
            create_all_packages
            ;;
        *)
            print_error "Unknown package type: $PACKAGE_TYPE"
            exit 1
            ;;
    esac
    
    echo ""
    print_success "Packaging completed successfully!"
    echo ""
    print_status "Package(s) created in: $OUTPUT_DIR"
    print_status "Next steps:"
    case "$PACKAGE_TYPE" in
        npm)
            echo "  - Install: npm install $OUTPUT_DIR/lumigo-tracer-custom-1.108.1-custom.tgz"
            ;;
        lambda)
            echo "  - Deploy to AWS Lambda using the zip file"
            ;;
        layer)
            echo "  - Create Lambda Layer: aws lambda publish-layer-version --layer-name lumigo-custom-tracer --zip-file fileb://$OUTPUT_DIR/layer-package.zip"
            ;;
        docker)
            echo "  - Build: cd $OUTPUT_DIR/docker-package && ./build.sh"
            ;;
        all)
            echo "  - Choose the appropriate package type for your deployment"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
