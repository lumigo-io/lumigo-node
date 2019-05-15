describe('tracer', () => {
  test('y', () => {});
});
/* XXX Example Started Trace
[
  {
    _info: {
      traceId: {
        Root: '1-5cdc228b-f7bb3a5c958d6970b6aad91c',
        Parent: '33facbaa3491ce5e',
        Sampled: 0,
        Version: 'Root=1',
        Time: '5cdc228b',
        TransactionId: 'f7bb3a5c958d6970b6aad91c',
        shortParentId: '228b',
      },
      logGroupName: '/aws/lambda/tracer-test-nirhod-another',
      logStreamName: '2019/05/15/[$LATEST]4af07c02f189402b8c3a4a963bd9e98e',
      tracer: { name: '@lumigo/tracer', version: '1.0.49' },
      messageId: '1d064140-5c60-5de2-a3e5-141678abbdd0',
      triggeredBy: 'sns',
      arn: 'arn:aws:sns:us-west-2:256063301105:tracer-test-nirhod-sns',
    },
    _children: [],
    _vendor: 'AWS',
    _transactionId: 'f7bb3a5c958d6970b6aad91c',
    _account: '256063301105',
    _memoryAllocated: '256',
    _version: '$LATEST',
    _runtime: 'AWS_Lambda_nodejs8.10',
    _readiness: 'warm',
    _containerTimestamp: '1557930428856',
    _invocationsSequence: '25',
    _messageVersion: '2',
    _token: 't_d2dab1ecadeb1edd128c',
    _id: '6d26e3c8-60a6-4cee-8a70-f525f47a4caf_started',
    _name: 'tracer-test-nirhod-another',
    _service: 'lambda',
    _started: 1557930635277,
    _ended: 1557930635277,
    _region: 'us-west-2',
    _type: 'function',
    maxFinishTime: 1557930695276,
    event:
      '{"Records":[{"EventSource":"aws:sns","EventVersion":"1.0","EventSubscriptionArn":"arn:aws:sns:us-west-2:256063301105:tracer-test-nirhod-sns:1d78c965-c20d-4fee-b658-bdd87bdbc9c9","Sns":{"Type":"Notification","MessageId":"1d064140-5c60-5de2-a3e5-141678abbdd0","TopicArn":"arn:aws:sns:us-west-2:256063301105:tracer-test-nirhod-sns","Subject":null,"Message":"{\\"StatusCode\\":200,\\"FunctionError\\":\\"Handled\\",\\"LogResult\\":\\"b2R1bGVzL2F3cy1zZGsvbGliL3JlcXVlc3QuanM6NjgzOjE0KVxcbiAgICBhdCBSZXF1ZXN0LnRyYW5zaXRpb24gKC92YXIvcnVudGltZS9ub2RlX21vZHVsZXMvYXdzLXNkay9saWIvcmVxdWVzdC5qczoyMjoxMClcXG4gICAgYXQgQWNjZXB0b3JTdGF0ZU1hY2hpbmUucnVuVG8gKC92YXIvcnVudGltZS9ub2RlX21vZHVsZXMvYXdzLXNkay9saWIvc3RhdGVfbWFjaGluZS5qczoxNDoxMilcXG4gICAgYXQgL3Zhci9ydW50aW1lL25vZGVfbW9kdWxlcy9hd3Mtc2RrL2xpYi9zdGF0ZV9tYWNoaW5lLmpzOjI2OjEwXFxuICAgIGF0IFJlcXVlc3QuPGFub255bW91cz4gKC92YXIvcnVudGltZS9ub2RlX21vZHVsZXMvYXdzLXNkay9saWIvcmVxdWVzdC5qczozODo5KVxcbiAgICBhdCBSZXF1ZXN0Ljxhbm9ueW1vdXM+ICgvdmFyL3J1bnRpbWUvbm9kZV9tb2R1bGVzL2F3cy1zZGsvbGliL3JlcXVlc3Q',
    envs:
      '{"LUMIGO_DEBUG":"true","LUMIGO_TRACER_TOKEN":"t_d2dab1ecadeb1edd128c","LUMIGO_TRACER_HOST":"sv3vbv1ah4.execute-api.eu-west-1.amazonaws.com","LUMIGO_TRACER_PATH":"/api/spans","LUMIGO_EDGE_TIMEOUT":"2","STACK_NAME":"tracer-test-nirhod","PATH":"/var/lang/bin:/usr/local/bin:/usr/bin/:/bin:/opt/bin","LD_LIBRARY_PATH":"/var/lang/lib:/lib64:/usr/lib64:/var/runtime:/var/runtime/lib:/var/task:/var/task/lib:/opt/lib","LANG":"en_US.UTF-8","TZ":":UTC","LAMBDA_TASK_ROOT":"/var/task","LAMBDA_RUNTIME_DIR":"/var/runtime","AWS_REGION":"us-west-2","AWS_DEFAULT_REGION":"us-west-2","AWS_LAMBDA_LOG_GROUP_NAME":"/aws/lambda/tracer-test-nirhod-another","AWS_LAMBDA_LOG_STREAM_NAME":"2019/05/15/[$LATEST]4af07c02f189402b8c3a4a963bd9e98e","AWS_LAMBDA_FUNCTION_NAME":"tracer-test-nirhod-another","AWS_LAMBDA_FUNCTION_MEMORY_SIZE":"256","AWS_LAMBDA_FUNCTION_VERSION":"$LATEST","_AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2","_AWS_XRAY_DAEMON_PORT":"2000","AWS_XRAY_DAEMON_ADDRESS":"169.254.79.2:2000","AWS_XRAY_CONTEXT_MISSING":"LOG_ERROR","_X_AMZN',
  },
];
*/
