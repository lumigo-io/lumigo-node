const token = 't_dc07fcd5c58d47ffa2b7c';
const debug = true;
const lumigo = require("./index")({
  token,
  debug,
  edgeHost: 'tracer-edge.internal-monitoring.golumigo.com',
});

const  AWS = require('aws-sdk');
const DocumentClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10', region: 'us-east-1'});

describe('tracer', () => {
  test("test", async ()=>{
    const callDB = async (event, context) => {
      const ID = JSON.stringify(Math.random() * 10000);
      const params ={
        TableName: 'test-table',
        Item: {
          id: ID ,
          message: 'DummyMessage',
        },
      };
      await DocumentClient.put(params).promise();
      const data = await DocumentClient.get({
        TableName: 'test-table',
        Key: {
          id: ID,
        },
      }).promise();
      console.log('item', data);
      return data.Item;
    };

    const tracedHandler = lumigo.trace(callDB);
    const res = await tracedHandler({}, {});
    console.log(res);
  })
});
