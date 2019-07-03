# **`lumigo-node`**

## TODO

2. Add prettier to CI/CD.
3. use the E2E tests with mocks (i.e. as partial system tests with lambdaLocal)
4. Test switchOff and local (isawsenv) with E2E tests.
5. Test a Lumigo-tracer error with E2E tests.
6. Semantic versioning? Auto bump?
7. Test interoperability with other sdks that use shimmer or other hooking system.
8. Add debug messages for Lumigo. Test specific flows
11. Talk with Uri and Saar about, about a misusage of shimmer wrapping.

## Incomplete Things

- **`Parsing of AWS Requests / Responses `** - currently only `DynamoDB` is parsed.

- **`EventFilter`**

- **`callbackWaitsForEmptyEventLoop`** - we should check if setting it to false/true alters the tracers behaviour.

- **`Removal of Lumigo from Stacktrace`**

- **`Inject X-Amzn.. Header to Request`**

- **`Try / catch Lumigo's errors e.g. parsing http hooks etc.`**

- **`Node 10.x adds a new https.request API, one that accepts (URL, options, ...)` - i.e we need to check if we handle the URL properly**
