# lumigo-node :stars:
[![CircleCI](https://circleci.com/gh/lumigo-io/lumigo-node.svg?style=svg)](https://circleci.com/gh/lumigo-io/lumigo-node)
[![codecov](https://codecov.io/gh/lumigo-io/lumigo-node/branch/master/graph/badge.svg?token=mUkKlI8ifC)](https://codecov.io/gh/lumigo-io/lumigo-node)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[`@lumigo/tracer`](https://) is Lumigo's distributed-tracing and performance monitoring agent for Node.js.


## Usage

Install `@lumigo/tracer`:

~~~sh
$ npm i @lumigo/tracer
~~~

Wrap your `handler` (replace `DEADBEEF` with your token):

~~~js
const lumigo = require('@lumigo/tracer')({ token: 'DEADBEEF' })

const myHandler = async (event, context, callback) => { ... }

exports.handler = lumigo.trace(myHandler)
~~~
