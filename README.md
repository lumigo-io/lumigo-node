# lumigo-node :stars:
[![CircleCI](https://circleci.com/gh/lumigo-io/lumigo-node.svg?style=svg&circle-token=47f40cb5e95e8532e73f69754fac65830b5e86a1)](https://circleci.com/gh/lumigo-io/lumigo-node)
[![codecov](https://codecov.io/gh/lumigo-io/lumigo-node/branch/master/graph/badge.svg?token=mUkKlI8ifC)](https://codecov.io/gh/lumigo-io/lumigo-node)
[![npm version](https://badge.fury.io/js/%40lumigo%2Ftracer.svg)](https://badge.fury.io/js/%40lumigo%2Ftracer)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)


[`@lumigo/tracer`](https://) is Lumigo's distributed-tracing and performance monitoring agent for Node.js.

 
## Usage 

### With Lambda Layers:
* Use the latest ARN version [from these tables](https://github.com/lumigo-io/lumigo-node/blob/master/layers)
### With Serverless framework:
* Install the [**serverless-lumigo-plugin**](https://github.com/lumigo-io/serverless-lumigo-plugin/blob/master/README.md)

### Manually:
Install `@lumigo/tracer`:

 npm: 
~~~bash
$ npm i @lumigo/tracer
~~~
    
Wrap your `handler` (replace `DEADBEEF` with your token):

~~~js
const lumigo = require('@lumigo/tracer')({ token: 'DEADBEEF' })

const myHandler = async (event, context, callback) => { ... }

exports.handler = lumigo.trace(myHandler)
~~~

## Configuration
* You can turn on the debug logs by setting the environment variable `LUMIGO_DEBUG=TRUE`
* You can prevent lumigo from sending keys that answer specific regexes by defining `LUMIGO_BLACKLIST_REGEX=["regex1", "regex2"]`. By default, we use the default regexes `[".*pass.*", ".*key.*", ".*secret.*", ".*credential.*", ".*passphrase.*"]`. All the regexes are case-insensitive.
* Similarly, you can prevent lumigo from sending the entire headers and body of specific domains using the environment variable LUMIGO_DOMAINS_SCRUBBER=[".*secret.*"] (give it a list which is a json parsable). By default, we will use ["secretsmanager\..*\.amazonaws\.com", "ssm\..*\.amazonaws\.com", "kms\..*\.amazonaws\.com"].
Note that if you do specify a domains list - the default list will be overridden.
* In case of need, there is a kill switch, that stops all the interventions of lumigo immediately, without changing the code. Simply add an environment variable `LUMIGO_SWITCH_OFF=TRUE`.


## Logging Programmatic Errors
In order to log custom errors which will be visible in the platform, you can use `console.log("[LUMIGO_LOG] <YOUR_MESSAGE>");` from anywhere in your lambda code.
