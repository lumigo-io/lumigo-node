# **`lumigo-node`**

There're still many unsolved edge cases. I'll add `CircleCI`, `100%` `jest` test
coverage, `eslint` and publish it when I return.


## Pull Docker Lambda

~~~
$ docker pull lambci/lambda:build-nodejs8.10
~~~

## Incomplete Things

- **`userHandler`** wrapper - currently we only support `async` userHandlers (without `callback`).
We need to `promisify` the userHandler for all edge cases.

- **`Propagation of errors`** - currently no errors are propagated to spans.

- **`Parsing of AWS Requests / Responses `** - currently only `DynamoDB` is parsed.

- **`EventFilter`**

- **`Removal of Lumigo from Stacktrace`**

- **`Use an HTTP Agent to reuse the TCP connection to the edge`**

- **`Debug Level Logs`**

- **`Inject X-Amzn.. Header to Request`**

- **`When locally used (i.e. not on AWS Lambda for now) auto-switch off`**
