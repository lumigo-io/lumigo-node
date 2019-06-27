# **`lumigo-node`**

## TODO

1. Try to minimize use of external packages (removed GOT, now what's left are uuid and clone-response)
3. use the E2E tests with mocks (i.e. as partial system tests with lambdaLocal)
4. Test switchOff and local (isawsenv) with E2E tests.
5. Test a Lumigo-tracer error with E2E tests.
6. Semantic versioning? Auto bump?
7. Test interoperability with other sdks that use shimmer or other hooking system.
8. Add debug messages for Lumigo. Test specific flows
11. Talk with Uri and Saar about, about a misusage of shimmer wrapping.
Add Eslint to circleci

## Incomplete Things

- **`Parsing of AWS Requests / Responses `** - currently only `DynamoDB` is parsed.

- **`EventFilter`**

- **`callbackWaitsForEmptyEventLoop`** - we should check if setting it to false/true alters the tracers behaviour.

- **`Removal of Lumigo from Stacktrace`**

- **`Use an HTTP Agent to reuse the TCP/TLS connection to the edge`**

- **`Inject X-Amzn.. Header to Request`**

- **`Try / catch Lumigo's errors e.g. parsing http hooks etc.`**

- **`Node 10.x adds a new https.request API, once that accepts (URL, options, ...)` - i.e we need to check if we handle the URL properly**
