const { lumigo } = require('/opt/nodejs');

const lumigoTracer = lumigo({ token: process.env.LUMIGO_TRACER_TOKEN });

exports.handler = lumigoTracer.trace(async (event, context) => {
  console.log('Processing event:', JSON.stringify(event, null, 2));
  
  // Simulate processing sensitive data
  const userData = {
    name: "John Doe",
    email: "john.doe@example.com",
    ssn: "123-45-6789",
    phone: "(555) 123-4567",
    credit_card: "4532 1234 5678 9012",
    address: "123 Main Street, Anytown, USA 12345",
    ip_address: "192.168.1.100"
  };
  
  console.log('Original user data:', JSON.stringify(userData, null, 2));
  
  // Simulate some processing
  const result = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Success',
      userData: userData, // This should be anonymized in Lumigo traces
      timestamp: new Date().toISOString()
    })
  };
  
  console.log('Returning result:', JSON.stringify(result, null, 2));
  
  return result;
});
