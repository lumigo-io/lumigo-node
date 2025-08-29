/**
 * Test script for the custom anonymization functionality
 * Run with: node test-anonymization.js
 */

const DataAnonymizer = require('./lib/anonymizer');

// Test data with PII
const testEvent = {
    type: "user_profile",
    data: {
        user: {
            id: "user_12345",
            name: "John Doe",
            email: "john.doe@example.com",
            age: 30,
            ssn: "123-45-6789",
            creditCard: "4111-1111-1111-1111",
            address: {
                street: "123 Main Street",
                city: "New York",
                state: "NY",
                zipCode: "10001",
                country: "USA"
            },
            phone: "+1-555-123-4567",
            dateOfBirth: "1994-03-15",
            driverLicense: "DL123456789",
            passportNumber: "P12345678",
            preferences: {
                theme: "dark",
                notifications: true,
                language: "en"
            },
            financial: {
                bankAccount: "1234567890",
                routingNumber: "021000021",
                accountType: "checking"
            }
        },
        action: "profile_update",
        timestamp: "2024-01-15T10:30:00Z",
        metadata: {
            ipAddress: "192.168.1.100",
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            sessionId: "sess_67890",
            deviceId: "dev_abc123"
        }
    },
    source: "web_application",
    version: "1.0"
};

console.log('🧪 Testing Custom Anonymization Module\n');

// Test with default patterns only
console.log('1. Testing with default anonymization patterns:');
const defaultAnonymizer = new DataAnonymizer();
const anonymizedDefault = defaultAnonymizer.anonymizeEvent(testEvent);
console.log('Default patterns applied:', defaultAnonymizer.getStats());
console.log('Anonymized SSN:', anonymizedDefault.data.user.ssn);
console.log('Anonymized Credit Card:', anonymizedDefault.data.user.creditCard);
console.log('Anonymized Email:', anonymizedDefault.data.user.email);
console.log('Anonymized Phone:', anonymizedDefault.data.user.phone);
console.log('Anonymized Address:', anonymizedDefault.data.user.address);
console.log('Anonymized IP:', anonymizedDefault.data.metadata.ipAddress);
console.log('');

// Test with custom patterns
console.log('2. Testing with custom anonymization patterns:');
const customAnonymizer = new DataAnonymizer([
    'custom.*pattern',
    'api.*key',
    'secret.*token'
]);
const anonymizedCustom = customAnonymizer.anonymizeEvent(testEvent);
console.log('Custom patterns applied:', customAnonymizer.getStats());
console.log('');

// Test with environment variable simulation
console.log('3. Testing with environment variable patterns:');
const envPatterns = ["ssn", "credit.*card", "bank.*account", "driver.*license", "passport.*number", "phone", "email", "address", "zip.*code", "date.*of.*birth", "ip.*address"];
const envAnonymizer = new DataAnonymizer(envPatterns);
const anonymizedEnv = envAnonymizer.anonymizeEvent(testEvent);
console.log('Environment patterns applied:', envAnonymizer.getStats());

// Show before/after comparison for key fields
console.log('\n4. Before/After Comparison:');
const keyFields = ['ssn', 'creditCard', 'email', 'phone', 'address', 'ipAddress'];
keyFields.forEach(field => {
    let originalValue, anonymizedValue;
    
    if (field === 'address') {
        originalValue = testEvent.data.user.address;
        anonymizedValue = anonymizedEnv.data.user.address;
    } else if (field === 'ipAddress') {
        originalValue = testEvent.data.metadata.ipAddress;
        anonymizedValue = anonymizedEnv.data.metadata.ipAddress;
    } else {
        originalValue = testEvent.data.user[field];
        anonymizedValue = anonymizedEnv.data.user[field];
    }
    
    console.log(`${field}:`);
    console.log(`  Original: ${JSON.stringify(originalValue)}`);
    console.log(`  Anonymized: ${JSON.stringify(anonymizedValue)}`);
    console.log('');
});

console.log('✅ Anonymization testing complete!');
console.log('\nTo test with the Lambda function:');
console.log('1. Deploy the updated function');
console.log('2. Send the test payload');
console.log('3. Check CloudWatch logs for anonymization');
console.log('4. Verify data is anonymized in Lumigo traces');
