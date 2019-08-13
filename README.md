# lumigo-node :stars:
[![CircleCI](https://circleci.com/gh/lumigo-io/lumigo-node.svg?style=svg&circle-token=47f40cb5e95e8532e73f69754fac65830b5e86a1)](https://circleci.com/gh/lumigo-io/lumigo-node)
[![codecov](https://codecov.io/gh/lumigo-io/lumigo-node/branch/master/graph/badge.svg?token=mUkKlI8ifC)](https://codecov.io/gh/lumigo-io/lumigo-node)
[![npm version](https://badge.fury.io/js/%40lumigo%2Ftracer.svg)](https://badge.fury.io/js/%40lumigo%2Ftracer)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)


[`@lumigo/tracer`](https://) is Lumigo's distributed-tracing and performance monitoring agent for Node.js.


## Usage 

Install `@lumigo/tracer`:

npm: 
~~~bash
$ npm i @lumigo/tracer
~~~

Lambda layer ARN:
~~~arn
arn:aws:lambda:YOUR-REGION:724777057400:layer:lumigo-node-tracer:15
~~~

Wrap your `handler` (replace `DEADBEEF` with your token):

~~~js
const lumigo = require('@lumigo/tracer')({ token: 'DEADBEEF' })

const myHandler = async (event, context, callback) => { ... }

exports.handler = lumigo.trace(myHandler)
~~~

