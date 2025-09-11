const lumigo = require('/opt/nodejs/lumigo-node');
const axios = require('axios');

const lumigoTracer = lumigo({ token: process.env.LUMIGO_TRACER_TOKEN });

exports.handler = lumigoTracer.trace(async (event, context) => {
  console.log('Processing event:', JSON.stringify(event, null, 2));
  
  // Parse event data
  let userData = {};
  try {
    if (event.body) {
      const parsedBody = JSON.parse(event.body);
      userData = parsedBody.data?.user || {};
    } else {
      userData = event.data?.user || {};
    }
  } catch (e) {
    console.error('Error parsing event:', e);
    userData = {
      id: "123",
      name: "John Smith",
      email: "john.smith@example.com",
      ssn: "123-45-6789",
      phone: "(555) 123-4567",
      address: "123 Main Street, Anytown, USA 12345",
      credit_card: "4532 1234 5678 9012",
      ip_address: "192.168.1.100",
      driver_license: "DL12345678901234567890",
      passport_number: "P123456789012345678901234567890",
      bank_account: "123456789012345678901234567890",
      zip_code: "12345-6789",
      date_of_birth: "1990-01-15",
      session_token: "sess_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
      auth_token: "auth_zyx987wvu654tsr321qpo098nml765kji432hgf210edc"
    };
  }
  
  console.log('Original user data:', JSON.stringify(userData, null, 2));
  
  try {
    // Make HTTP call to test HTTP anonymization
    console.log('Making HTTP call to test HTTP anonymization...');
    const httpResponse = await axios.post('https://jsonplaceholder.typicode.com/posts', {
      user: userData,
      message: 'HTTP operations completed successfully',
      operations: ['HTTP REST service call'],
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-12345',
        'X-API-Key': 'api-key-67890'
      }
    });
    
    console.log('HTTP call successful, status:', httpResponse.status);
    console.log('HTTP response data:', JSON.stringify(httpResponse.data, null, 2));
    
    // Return success response
    const result = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'HTTP operations completed successfully',
        operations: ['HTTP REST service call'],
        userData: userData, // This should be anonymized in Lumigo traces
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
    
    console.log('Returning result:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error('Error during HTTP operations:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'HTTP operations failed',
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
});