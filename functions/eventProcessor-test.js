const lumigo = require('@lumigo/tracer');

// Create the tracer instance
const tracer = lumigo();

// Define the handler function
const myHandler = async (event, context) => {
    console.log('🔍 Lumigo Connection Test Lambda started');
    
    try {
        // Test 1: Basic function execution
        console.log('✅ Lambda function executing normally');
        
        // Test 2: Check environment variables
        console.log('🔧 Environment Variables:');
        console.log('  - LUMIGO_TRACER_TOKEN:', process.env.LUMIGO_TRACER_TOKEN ? 'SET' : 'NOT SET');
        console.log('  - AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
        console.log('  - NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
        
        // Test 3: Try to make a simple HTTP request to test network
        try {
            const https = require('https');
            const url = require('url');
            
            const testUrl = 'https://httpbin.org/get';
            console.log(`🌐 Testing network connectivity to: ${testUrl}`);
            
            const response = await new Promise((resolve, reject) => {
                const req = https.get(testUrl, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ statusCode: res.statusCode, data }));
                });
                req.on('error', reject);
                req.setTimeout(5000, () => reject(new Error('Timeout')));
            });
            
            console.log(`✅ Network test successful: ${response.statusCode}`);
        } catch (networkError) {
            console.error('❌ Network test failed:', networkError.message);
        }
        
        // Test 4: Check if Lumigo tracer is working
        console.log('🔍 Checking Lumigo tracer status...');
        console.log('  - Tracer object:', typeof tracer);
        console.log('  - Tracer methods:', Object.keys(tracer));
        
        // Test 5: Try to manually trigger some Lumigo functionality
        if (tracer.info) {
            try {
                tracer.info('Test message from Lambda');
                console.log('✅ Lumigo tracer.info() method working');
            } catch (error) {
                console.error('❌ Lumigo tracer.info() failed:', error.message);
            }
        }
        
        const result = {
            message: 'Lumigo Connection Test Complete',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
            tests: {
                lambdaExecution: 'PASS',
                environmentVariables: process.env.LUMIGO_TRACER_TOKEN ? 'PASS' : 'FAIL',
                networkConnectivity: 'TESTED',
                lumigoTracer: typeof tracer === 'object' ? 'PASS' : 'FAIL'
            }
        };
        
        console.log('📊 Test Results:', JSON.stringify(result, null, 2));
        
        return {
            statusCode: 200,
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
    } catch (error) {
        console.error('❌ Test Lambda failed:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Test Lambda failed',
                message: error.message,
                requestId: context.awsRequestId
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};

// Export the handler wrapped with Lumigo tracing
exports.handler = tracer.trace(myHandler);
