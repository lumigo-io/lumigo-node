const lumigo = require('./lumigo-node');

// Initialize the modified Lumigo tracer with anonymization
const tracer = lumigo.initTracer({
    token: process.env.LUMIGO_TRACER_TOKEN,
    debug: true
});

const myHandler = async (event, context) => {
    console.log('eventProcessor Lambda started');
    console.log('🔧 Environment variables:');
    console.log('  - LUMIGO_ANONYMIZE_ENABLED:', process.env.LUMIGO_ANONYMIZE_ENABLED);
    console.log('  - LUMIGO_ANONYMIZE_REGEX:', process.env.LUMIGO_ANONYMIZE_REGEX);
    console.log('  - LUMIGO_ANONYMIZE_DATA_SCHEMA:', process.env.LUMIGO_ANONYMIZE_DATA_SCHEMA);
    console.log('🔍 Lambda received ORIGINAL event (not anonymized):');
    console.log('Event type:', event.type || 'unknown');
    console.log('Event data keys:', event.data ? Object.keys(event.data) : 'none');

    if (event.data && event.data.user) {
        console.log('✅ Lambda can access original user data:');
        console.log('  - User ID:', event.data.user.id);
        console.log('  - User Name:', event.data.user.name);
        console.log('  - User Email:', event.data.user.email);
        console.log('  - User SSN:', event.data.user.ssn);
        console.log('  - User Phone:', event.data.user.phone);
    }

    try {
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
            eventType = event.type || 'unknown';
            eventData = event.data || {};
        }

        const result = {
            message: 'Event processed successfully with anonymization',
            timestamp: new Date().toISOString(),
            eventType: eventType,
            eventData: eventData,
            requestId: context.awsRequestId,
            processingNote: 'Lambda processed original, unmodified data. Using modified Lumigo tracer with PII anonymization.',
            anonymizationNote: 'PII data will be anonymized in Lumigo traces using embedded anonymization logic'
        };

        console.log('Processing result:', JSON.stringify(result, null, 2));
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

exports.handler = tracer.trace(myHandler);
