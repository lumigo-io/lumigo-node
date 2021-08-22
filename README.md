# lumigo-node :stars:
[![CircleCI](https://circleci.com/gh/lumigo-io/lumigo-node.svg?style=svg&circle-token=47f40cb5e95e8532e73f69754fac65830b5e86a1)](https://circleci.com/gh/lumigo-io/lumigo-node)
[![codecov](https://codecov.io/gh/lumigo-io/lumigo-node/branch/master/graph/badge.svg?token=mUkKlI8ifC)](https://codecov.io/gh/lumigo-io/lumigo-node)
[![npm version](https://badge.fury.io/js/%40lumigo%2Ftracer.svg)](https://badge.fury.io/js/%40lumigo%2Ftracer)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)


This is [`@lumigo/tracer`](https://), Lumigo's Node.js agent for distributed tracing and performance monitoring.

Supported NodeJS runtimes: 8.10, 10.x, 12.x, 14.x

 
## Usage 

The `@lumigo/tracer` package allows you to pursue automated metric gathering through Lambda Layers, automated metric gathering and instrumentation through the Serverless framework, or manual metric creation and implementation.

### With Lambda Layers:

* When configuring your Lambda functions, include the appropriate Lambda Layer ARN [from these tables](https://github.com/lumigo-io/lumigo-node/blob/master/layers)

*Note* - Lambda Layers are an optional feature. If you decide to use this capability, the list of Lambda layers available is available [here.](https://github.com/lumigo-io/lumigo-node/blob/master/layers)

### With Serverless framework:
* To configure the Serverless Framework to work with Lumigo, simply install our plugin: [**serverless-lumigo-plugin**](https://github.com/lumigo-io/serverless-lumigo-plugin/blob/master/README.md)

### Manually:

To manually configure Lumigo in your Lambda functions:

* First, install the `@lumigo/tracer` package using NPM:

 npm: 
~~~bash
$ npm i @lumigo/tracer
~~~
    
* Next, wrap your `handler` in lumigo's `trace` function (note: replace `YOUR-TOKEN-HERE` with your Lumigo API token):

~~~js
const lumigo = require('@lumigo/tracer')({ token: 'YOUR-TOKEN-HERE' })

const myHandler = async (event, context, callback) => { ... }

exports.handler = lumigo.trace(myHandler)
~~~

* Your function is now fully instrumented

## Configuration
`@lumigo/tracer` offers several different configuration options. Pass these to the Lambda function as environment variables:

* `LUMIGO_DEBUG=TRUE` - Enables debug logging
* `LUMIGO_SECRET_MASKING_REGEX='["regex1", "regex2"]'` - Prevents Lumigo from sending keys that match the supplied regular expressions. All regular expressions are case-insensitive. By default, Lumigo applies the following regular expressions: `[".*pass.*", ".*key.*", ".*secret.*", ".*credential.*", ".*passphrase.*"]`. 
* `LUMIGO_DOMAINS_SCRUBBER='[".*secret.*"]'` - Prevents Lumigo from collecting both request and response details from a list of domains. This accepts a comma-separated list of regular expressions that is JSON-formatted. By default, the tracer uses `["secretsmanager\..*\.amazonaws\.com", "ssm\..*\.amazonaws\.com", "kms\..*\.amazonaws\.com"]`. **Note** - These defaults are overridden when you define a different list of regular expressions.
* `LUMIGO_SWITCH_OFF=TRUE` - In the event a critical issue arises, this turns off all actions that Lumigo takes in response to your code. This happens without a deployment, and is picked up on the next function run once the environment variable is present.

### Step Functions

If your function is part of a set of step functions, you can add the flag `step_function: true` to the Lumigo tracer import. Alternatively, you can configure the step function using an environment variable `LUMIGO_STEP_FUNCTION=True`. When this is active, Lumigo tracks all states in the step function in a single transaction, easing debugging and observability.
```
const lumigo = require('@lumigo/tracer')({ token: 'DEADBEEF', step_function: true })
```
Note: the tracer adds the key `"_lumigo"` to the return value of the function. 

If you override the `"Parameters"` configuration, add `"_lumigo.$": "$._lumigo"` to ensure this value is still present.

Below is an example configuration for a Lambda function that is part of a step function that has overridden its parameters:
```
"States": {
    "state1": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-west-2:ACCOUNT:function:FUNCTION_NAME",
      "Parameters": {
          "Changed": "parameters",
          "_lumigo.$": "$._lumigo"
        },
      "Next": "state2"
    },
    "state2": {
      "Type": "pass",
      "End": true
    }
}
```

## Logging Programmatic Errors
With the tracer configured, simply call `console.log("[LUMIGO_LOG] <YOUR_MESSAGE>");` to cerate custom errors that are visible throughout the platform. This can be used anywhere in your Lambda code, and is included with the `@lumigo/tracer` package.

## Adding Execution Tags
You can add execution tags to a function with dynamic values using the parameter `addExecutionTag`.

These tags will be searchable from within the Lumigo platform.

### Adding tags for Manual tracing
To add a tag to a manual trace statement:

* Add `const lumigo = require('@lumigo/tracer')({ token: 'YOUR-TOKEN-HERE' })` to your code.
* Add execution tags by using `lumigo.addExecutionTag('<key>', '<value>');`

### Adding tags for Auto tracing
To add a tag to an automatically-traced function:

* Add `const lumigo = require('@lumigo/tracer')` to the top of your handler's .js file
* Use `lumigo.addExecutionTag('<key>', '<value>');` anywhere in your lambda code.

### Execution Tag Limitations:
Execution tags are subject to the following limitations:

* The maximum number of tags is 50. 
* Key length must be between 1 and 50.
* Value length must be between 1 and 70.

### Scrubbing Limitations:
Secrets scrubbing are subject to the following limitations:

* support only json data secrets scrubbing
