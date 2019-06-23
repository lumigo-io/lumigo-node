# **`lumigo-node`**

There're still many unsolved edge cases. I'll add `CircleCI`, `100%` `jest` test
coverage, `eslint` and publish it when I return.

## TODO

1. Try to minimize use of external packages (removed GOT, now what's left are uuid and clone-response)
2. Orthogonal unit tests with 100% code cov
3. use the E2E tests with mocks (i.e. as partial system tests with lambdaLocal)
4. Test switchOff and local (isawsenv) with E2E tests.
5. Test a Lumigo-tracer error with E2E tests.

## Incomplete Things

- **`Parsing of AWS Requests / Responses `** - currently only `DynamoDB` is parsed.

- **`EventFilter`**

- **`callbackWaitsForEmptyEventLoop`** - we should check if setting it to false/true alters the tracers behaviour.

- **`Removal of Lumigo from Stacktrace`**

- **`Use an HTTP Agent to reuse the TCP connection to the edge`**

- **`Inject X-Amzn.. Header to Request`**

- **`Try / catch Lumigo's errors e.g. parsing http hooks etc.`**
