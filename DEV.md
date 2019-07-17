# **`lumigo-node`**

## TODO

1. Separate between dev_example/ and example/
2. Add prettier to CI/CD.
3. use the E2E tests with mocks (i.e. as partial system tests with lambdaLocal)
4. Test switchOff and local (isawsenv) with E2E tests.
5. Test a Lumigo-tracer error with E2E tests.
6. Semantic versioning? Auto bump?
7. Test interoperability with other sdks that use shimmer or other hooking system.
11. Talk with Uri and Saar about, about a misusage of shimmer wrapping.

## Incomplete Things

- **`Parsing of AWS Requests / Responses `** - currently only `DynamoDB` is parsed.

- **`EventFilter`**

- **`callbackWaitsForEmptyEventLoop`** - we should check if setting it to false/true alters the tracers behaviour.

- **`Removal of Lumigo from Stacktrace`**

- **`Inject X-Amzn.. Header to Request`**

- **`Try / catch lumigo's parsing http hooks etc.`**

- **`node-fetch: parsing compressed bodies`** - node-fetch and other implementations compress things on its own (not using the standard
   http.request()), as a result it returns a response with a compressed body showing up in Lumigo's dashboard.
   see https://github.com/bitinn/node-fetch/blob/95286f52bb866283bc69521a04efe1de37b26a33/src/index.js#L224
