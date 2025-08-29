const lumigo = require('@lumigo/tracer');

// Create the tracer instance directly
const tracer = lumigo();

// Define the handler function
const myHandler = async (event, context) => {
    console.log('🔍 Basic Lumigo Tracing Test Lambda started');
    
    try {
        // Test 1: Basic function execution
        console.log('✅ Lambda function executing normally');
        
        // Test 2: Check environment variables
        console.log('🔧 Environment Variables:');
        console.log('  - LUMIGO_TRACER_TOKEN:', process.env.LUMIGO_TRACER_TOKEN ? 'SET' : 'NOT SET');
        console.log('  - AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
        
        // Test 3: Try to manually trigger Lumigo tracing
        console.log('🔍 Testing basic Lumigo tracing...');
        
        // Test 4: Create some test data that should be traced
        const testData = {
            message: 'Test message for Lumigo tracing',
            timestamp: new Date().toISOString(),
            testValue: 'This should appear in Lumigo traces',
            requestId: context.awsRequestId
        };
        
        console.log('📊 Test data created:', JSON.stringify(testData, null, 2));
        
        // Test 5: Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = {
            message: 'Basic Lumigo Tracing Test Complete',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
            testData: testData,
            status: 'SUCCESS'
        };
        
        console.log('📊 Final result:', JSON.stringify(result, null, 2));
        
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

// Export the handler wrapped with basic Lumigo tracing (no wrapper)
exports.handler = tracer.trace(myHandler);
