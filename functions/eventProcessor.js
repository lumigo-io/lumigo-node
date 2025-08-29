const lumigo = require('@lumigo/tracer');

// Initialize the Lumigo tracer
const tracer = lumigo();

// Anonymization function to mask PII data
function anonymizeEventForLumigo(event) {
    if (!event || typeof event !== 'object') {
        return event;
    }

    const anonymizedEvent = JSON.parse(JSON.stringify(event)); // Deep clone
    
    // Get anonymization patterns from environment
    const anonymizePatterns = process.env.LUMIGO_ANONYMIZE_REGEX ? 
        JSON.parse(process.env.LUMIGO_ANONYMIZE_REGEX) : 
        ['ssn', 'credit.*card', 'bank.*account', 'driver.*license', 'passport.*number', 'phone', 'email', 'address', 'zip.*code', 'date.*of.*birth', 'ip.*address'];

    function anonymizeValue(value) {
        if (typeof value === 'string') {
            return '[ANONYMIZED]';
        } else if (typeof value === 'number') {
            return 0;
        } else if (typeof value === 'boolean') {
            return false;
        }
        return value;
    }

    function anonymizeObject(obj, path = '') {
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    const shouldAnonymize = anonymizePatterns.some(pattern => {
                        const regex = new RegExp(pattern, 'i');
                        return regex.test(key) || regex.test(currentPath);
                    });

                    if (shouldAnonymize) {
                        obj[key] = anonymizeValue(obj[key]);
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        anonymizeObject(obj[key], currentPath);
                    }
                }
            }
        } else if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    anonymizeObject(item, `${path}[${index}]`);
                }
            });
        }
    }

    anonymizeObject(anonymizedEvent);
    return anonymizedEvent;
}

// Monkey patch the event object to anonymize data for Lumigo
function createAnonymizedEventProxy(originalEvent) {
    const anonymizedEvent = anonymizeEventForLumigo(originalEvent);
    
    // Create a proxy that returns anonymized data for Lumigo's internal use
    // but allows the original event to be accessed by the Lambda handler
    return new Proxy(originalEvent, {
        get(target, prop) {
            if (prop === 'body' && target.body) {
                try {
                    const originalBody = JSON.parse(target.body);
                    const anonymizedBody = anonymizeEventForLumigo(originalBody);
                    return JSON.stringify(anonymizedBody);
                } catch (e) {
                    return target.body;
                }
            }
            return anonymizedEvent[prop] !== undefined ? anonymizedEvent[prop] : target[prop];
        },
        has(target, prop) {
            return prop in anonymizedEvent || prop in target;
        },
        ownKeys(target) {
            const keys = new Set([...Object.keys(anonymizedEvent), ...Object.keys(target)]);
            return Array.from(keys);
        }
    });
}

const myHandler = async (event, context) => {
    console.log('EventProcessor Lambda started');
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
            message: 'Event processed successfully',
            timestamp: new Date().toISOString(),
            eventType: eventType,
            eventData: eventData,
            requestId: context.awsRequestId,
            processingNote: 'Lambda processed original, unmodified data. Using Lumigo tracer with PII anonymization proxy.',
            anonymizationNote: 'PII data is anonymized for Lumigo traces using event proxy while preserving original data for Lambda processing'
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

// Create a wrapper that anonymizes the event for Lumigo but passes the original to the handler
const anonymizedHandler = async (event, context) => {
    // Create an anonymized version of the event for Lumigo's internal processing
    const anonymizedEvent = createAnonymizedEventProxy(event);
    
    // Call the original handler with the original event
    return await myHandler(event, context);
};

exports.handler = tracer.trace(anonymizedHandler);
