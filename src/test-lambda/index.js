const { lumigo } = require('/opt/nodejs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const lumigoTracer = lumigo({ token: process.env.LUMIGO_TRACER_TOKEN });

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

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
      name: "John Doe",
      email: "john.doe@example.com",
      ssn: "123-45-6789",
      phone: "(555) 123-4567",
      credit_card: "4532 1234 5678 9012",
      address: "123 Main Street, Anytown, USA 12345",
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
  
  const tableName = `test-users-${Date.now()}`;
  const userId = userData.id || '123';
  
  try {
    // Step 1: Create DynamoDB table
    console.log('Creating DynamoDB table:', tableName);
    const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
    const createTableParams = {
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    };
    
    await client.send(new CreateTableCommand(createTableParams));
    console.log('Table created successfully');
    
    // Wait for table to be active
    console.log('Waiting for table to become active...');
    const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
    let tableStatus = 'CREATING';
    while (tableStatus !== 'ACTIVE') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const describeResult = await client.send(new DescribeTableCommand({ TableName: tableName }));
        tableStatus = describeResult.Table.TableStatus;
        console.log(`Table status: ${tableStatus}`);
      } catch (e) {
        console.log('Waiting for table...');
      }
    }
    console.log('Table is now active');
    
    // Step 2: Insert user data into DynamoDB
    console.log('Inserting user data into DynamoDB');
    const putParams = {
      TableName: tableName,
      Item: {
        id: userId,
        ...userData,
        createdAt: new Date().toISOString(),
        requestId: context.awsRequestId
      }
    };
    
    await dynamodb.send(new PutCommand(putParams));
    console.log('User data inserted successfully');
    
    // Step 3: Retrieve user data from DynamoDB
    console.log('Retrieving user data from DynamoDB');
    const getParams = {
      TableName: tableName,
      Key: { id: userId }
    };
    
    const retrievedData = await dynamodb.send(new GetCommand(getParams));
    console.log('Retrieved user data:', JSON.stringify(retrievedData.Item, null, 2));
    
    // Step 4: Update user data
    console.log('Updating user data in DynamoDB');
    const updateParams = {
      TableName: tableName,
      Key: { id: userId },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':status': 'processed',
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const updatedData = await dynamodb.send(new UpdateCommand(updateParams));
    console.log('Updated user data:', JSON.stringify(updatedData.Attributes, null, 2));
    
    // Step 5: Query all items (scan)
    console.log('Scanning all items in table');
    const scanParams = {
      TableName: tableName
    };
    
    const scanResult = await dynamodb.send(new ScanCommand(scanParams));
    console.log('Scanned items count:', scanResult.Count);
    
    // Step 6: Delete the table
    console.log('Deleting DynamoDB table:', tableName);
    const { DeleteTableCommand } = require('@aws-sdk/client-dynamodb');
    const deleteParams = {
      TableName: tableName
    };
    
    await client.send(new DeleteTableCommand(deleteParams));
    console.log('Table deleted successfully');
    
    // Return success response
    const result = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'DynamoDB operations completed successfully',
        operations: [
          'Created table',
          'Inserted user data',
          'Retrieved user data',
          'Updated user data',
          'Scanned table',
          'Deleted table'
        ],
        userData: userData, // This should be anonymized in Lumigo traces
        retrievedData: retrievedData.Item, // This should also be anonymized
        updatedData: updatedData.Attributes, // This should also be anonymized
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
    
    console.log('Returning result:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error('Error during DynamoDB operations:', error);
    
    // Try to clean up table if it exists
    try {
      const { DeleteTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
      
      // First check if table exists and is in a deletable state
      try {
        const describeResult = await client.send(new DescribeTableCommand({ TableName: tableName }));
        const tableStatus = describeResult.Table.TableStatus;
        
        if (tableStatus === 'ACTIVE') {
          await client.send(new DeleteTableCommand({ TableName: tableName }));
          console.log('Cleanup: Table deleted after error');
        } else {
          console.log(`Cleanup: Table is in ${tableStatus} state, skipping deletion`);
        }
      } catch (describeError) {
        if (describeError.name === 'ResourceNotFoundException') {
          console.log('Cleanup: Table does not exist, no cleanup needed');
        } else {
          console.error('Cleanup: Error describing table:', describeError.message);
        }
      }
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError.message);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'DynamoDB operations failed',
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
});
