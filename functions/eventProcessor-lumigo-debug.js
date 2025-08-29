const lumigo = require('@lumigo/tracer');

// Create the tracer instance
const tracer = lumigo();

// Define the handler function
const myHandler = async (event, context) => {
    console.log('🔍 Lumigo Debug Test Lambda started');
    
    try {
        // Test 1: Basic function execution
        console.log('✅ Lambda function executing normally');
        
        // Test 2: Check environment variables
        console.log('🔧 Environment Variables:');
        console.log('  - LUMIGO_TRACER_TOKEN:', process.env.LUMIGO_TRACER_TOKEN ? 'SET' : 'NOT SET');
        console.log('  - AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
        
        // Test 3: Check Lumigo tracer object
        console.log('🔍 Lumigo Tracer Object:');
        console.log('  - Type:', typeof tracer);
        console.log('  - Methods:', Object.keys(tracer));
        console.log('  - Tracer object:', JSON.stringify(tracer, null, 2));
        
        // Test 4: Try to manually trigger Lumigo methods
        if (tracer.info) {
            try {
                console.log('🔍 Testing tracer.info()...');
                tracer.info('Manual test message from Lambda');
                console.log('✅ tracer.info() executed successfully');
            } catch (error) {
                console.error('❌ tracer.info() failed:', error.message);
            }
        }
        
        if (tracer.warn) {
            try {
                console.log('🔍 Testing tracer.warn()...');
                tracer.warn('Manual warning message from Lambda');
                console.log('✅ tracer.warn() executed successfully');
            } catch (error) {
                console.error('❌ tracer.warn() failed:', error.message);
            }
        }
        
        if (tracer.error) {
            try {
                console.log('🔍 Testing tracer.error()...');
                tracer.error('Manual error message from Lambda');
                console.log('✅ tracer.error() executed successfully');
            } catch (error) {
                console.error('❌ tracer.error() failed:', error.message);
            }
        }
        
        // Test 5: Check if there are any Lumigo internal logs
        console.log('🔍 Checking for Lumigo internal logs...');
        
        // Test 6: Create test data
        const testData = {
            message: 'Debug test for Lumigo tracing',
            timestamp: new Date().toISOString(),
            testValue: 'This should trigger Lumigo tracing',
            requestId: context.awsRequestId,
            tracerInfo: {
                hasInfo: !!tracer.info,
                hasWarn: !!tracer.warn,
                hasError: !!tracer.error,
                hasTrace: !!tracer.trace
            }
        };
        
        console.log('📊 Test data created:', JSON.stringify(testData, null, 2));
        
        // Test 7: Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const result = {
            message: 'Lumigo Debug Test Complete',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
            testData: testData,
            status: 'DEBUG_COMPLETE'
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
        console.error('❌ Debug Lambda failed:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Debug Lambda failed',
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
