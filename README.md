# **`lumigo-node`**

There're still many unsolved edge cases. I'll add `CircleCI`, `100%` `jest` test
coverage, `eslint` and publish it when I return.


## Incomplete Things

- **`Propagation of errors`** - currently no errors are propagated to spans.

- **`Parsing of AWS Requests / Responses `** - currently only `DynamoDB` is parsed.

- **`EventFilter`**

- **`Removal of Lumigo from Stacktrace`**

- **`Use an HTTP Agent to reuse the TCP connection to the edge`**

- **`Debug Level Logs`**

- **`Inject X-Amzn.. Header to Request`**

- **`When locally used (i.e. not on AWS Lambda for now) auto-switch off`**
