const lumigo = require('@lumigo/tracer');

// Create the tracer instance directly
const tracer = lumigo();

// Define the handler function
const myHandler = async (event, context) => {
    console.log('EventProcessor Lambda started (Simple Version)');
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        // Parse the event body if it's from API Gateway
        let eventData = {};
        let eventType = 'unknown';
        
        if (event.body) {
            try {
                const parsedBody = JSON.parse(event.body);
                eventType = parsedBody.type || 'unknown';
                eventData = parsedBody.data || {};
            } catch (parseError) {
                console.error('Error parsing event body:', parseError);
                eventData = { error: 'Failed to parse request body' };
            }
        } else {
            // Direct Lambda invocation
            eventType = event.type || 'unknown';
            eventData = event.data || {};
        }
        
        // Basic event processing logic
        const result = {
            message: 'Event processed successfully (Simple Version)',
            timestamp: new Date().toISOString(),
            eventType: eventType,
            eventData: eventData,
            requestId: context.awsRequestId,
            version: 'simple-no-wrapper'
        };
        
        console.log('Processing result:', JSON.stringify(result, null, 2));
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
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

// Export the handler wrapped with basic Lumigo tracing
exports.handler = tracer.trace(myHandler);
