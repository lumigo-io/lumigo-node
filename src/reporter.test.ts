/* eslint-disable */
import { TracerGlobals } from './globals';
import * as reporter from './reporter';
import * as utils from './utils';
import { AxiosMocker } from '../testUtils/axiosMocker';
import { getEventEntitySize, getJSONBase64Size, setDebug } from './utils';
import { encode } from 'utf8';
import { scrubSpans, sendSpans } from './reporter';
import { ConsoleWritesForTesting } from '../testUtils/consoleMocker';

describe('reporter', () => {
  test('sendSingleSpan', async () => {
    const token = 'DEADBEEF';
    utils.setDebug();
    TracerGlobals.setTracerInputs({ token });
    const span = { a: 'b', c: 'd' };

    await reporter.sendSingleSpan(span);

    const spans = AxiosMocker.getSentSpans();
    expect(spans).toEqual([[span]]);
  });

  test('isSpansContainsErrors', async () => {
    const genReturnValue = (statusCode) => ({
      returnValue: {
        statusCode,
      },
    });
    const dummy = { dummy: 'dummy' };
    const error = { error: 'error' };
    const spansWithStatusCode = [dummy, genReturnValue(200), dummy];
    const spansWithErrorStatusCode = [dummy, genReturnValue(500), dummy];
    const spansWithError = [dummy, error, dummy];
    const spansWithoutError = [dummy, dummy];

    const assertSpans = (spans, result) =>
      expect(reporter.isSpansContainsErrors(spans)).toEqual(result);

    assertSpans(spansWithStatusCode, false);
    assertSpans(spansWithErrorStatusCode, true);
    assertSpans(spansWithError, true);
    assertSpans(spansWithoutError, false);
  });

  test('sendSpans - use tracerInputs', async () => {
    TracerGlobals.setTracerInputs({ maxSizeForRequest: 10 });
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([[{ e: 'f', g: 'h' }]]);
  });

  test('sendSpans - simple flow', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
  });

  test('sendSpans - send only on errors without errors', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    utils.setSendOnlyIfErrors();
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([]);
  });

  test('sendSpans - send only on errors with errors', async () => {
    const token = 'DEADBEEF';
    TracerGlobals.setTracerInputs({ token });
    utils.setSendOnlyIfErrors();
    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h', error: 'error' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
  });

  test('sendSpans - with bad LUMIGO_SECRET_MASKING_REGEX still send spans', async () => {
    const token = 'DEADBEEF';
    process.env.LUMIGO_SECRET_MASKING_REGEX = 'NON-VALID-JSON';
    TracerGlobals.setTracerInputs({ token });

    const spans = [
      { a: 'b', c: 'd' },
      { e: 'f', g: 'h', error: 'error' },
    ];

    await reporter.sendSpans(spans);

    const sentSpans = AxiosMocker.getSentSpans();
    expect(sentSpans).toEqual([spans]);
  });

  test('forgeRequestBody - simple flow', async () => {
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const spans = [{ dummy }, { dummy }, { dummyEnd }];

    const expectedResult = [{ dummy }, { dummyEnd }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeAndScrubRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  describe('forgeAndScrubRequestBody parsing tests', () => {
    test('forgeAndScrubRequestBody - scrub secrets', async () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              request: {
                headers: {
                  'content-type': 'json',
                },
                body: JSON.stringify({
                  secret: 'aaaaaaaa',
                }),
              },
              response: {
                headers: {
                  'content-type': 'json',
                },
                body: JSON.stringify({
                  secret: 'aaaaaaaa',
                }),
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResult = [
        {
          info: {
            httpInfo: {
              request: {
                headers: JSON.stringify({
                  'content-type': 'json',
                }),
                body: JSON.stringify({
                  secret: '****',
                }),
              },
              response: {
                headers: JSON.stringify({
                  'content-type': 'json',
                }),
                body: JSON.stringify({
                  secret: '****',
                }),
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = reporter.forgeAndScrubRequestBody(spans, expectedResultSize);
      expect(actual).toEqual(JSON.stringify(expectedResult));
    });

    test('forgeAndScrubRequestBody scrub domain', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { Tyler: 'Durden', secretKey: 'lumigo' },
                body: 'the first rule of fight club',
              },
              response: {
                headers: { Peter: 'Parker' },
                body: 'Well, Tony is dead.',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: 'The data is not available',
                host: 'your.mind.com',
              },
              response: {
                body: 'The data is not available',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);
      process.env.LUMIGO_DOMAINS_SCRUBBER = '["mind"]';
      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });
    test('forgeAndScrubRequestBody', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          truncated: false,
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                headers: { Tyler: 'Durden', secretKey: 'lumigo' },
                body: 'the first rule of fight club',
              },
              response: {
                headers: { Peter: 'Parker' },
                body: 'Well, Tony is dead.',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          truncated: false,
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"the first rule of fight club"',
                headers: '{"Tyler":"Durden","secretKey":"****"}',
              },
              response: {
                body: '"Well, Tony is dead."',
                headers: '{"Peter":"Parker"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('forgeAndScrubRequestBody long response', () => {
      let manyA = 'a'.repeat(88);
      let manyManyA = 'a'.repeat(1268);
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: '{"secret": "secret"}',
              },
              response: {
                truncated: true,
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: `{"a":"${manyA}","b":"${manyA}","key":"${manyA}","password":"${manyA}","e":"${manyA}","secret":"${manyA}","f":"${manyA}","g":"${manyA}","h":"${manyManyA}"`,
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '{"secret":"****"}',
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                truncated: true,
                body: `{"a":"${manyA}","b":"${manyA}","key":"****","password":"****","e":"${manyA}","secret":"****","f":"${manyA}","g":"${manyA}","h":"${manyManyA}"}`,
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('forgeAndScrubRequestBody short response', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { Tyler: 'Durden', secretKey: 'lumigo' },
                body: 'the first rule of fight club',
              },
              response: {
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: '{"secret": "abcd"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"the first rule of fight club"',
                headers: '{"Tyler":"Durden","secretKey":"****"}',
                host: 'your.mind.com',
              },
              response: {
                body: '{"secret":"****"}',
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('forgeAndScrubRequestBody => decode utf-8', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { Tyler: 'Durden', secretKey: 'lumigo' },
                body: 'the first rule of fight club',
              },
              response: {
                headers: { Peter: 'Parker' },
                body: encode('Well, Tony is dead.'),
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"the first rule of fight club"',
                headers: '{"Tyler":"Durden","secretKey":"****"}',
                host: 'your.mind.com',
              },
              response: {
                body: '"Well, Tony is dead."',
                headers: '{"Peter":"Parker"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('forgeAndScrubRequestBody contain json header but not json body', () => {
      const dummyEnd = 'dummyEnd';
      const spans = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: {
                  Tyler: 'Durden',
                  secretKey: 'lumigo',
                  'content-type': 'application/json',
                },
                body: 'Scotty doesnt know secret...',
              },
              response: {
                headers: { Peter: 'Parker', 'content-type': 'application/json' },
                body: 'That Fiona and me... password',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expected = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                body: '"Scotty doesnt know secret..."',
                headers: '{"Tyler":"Durden","secretKey":"****","content-type":"application/json"}',
                host: 'your.mind.com',
              },
              response: {
                body: '"That Fiona and me... password"',
                headers: '{"Peter":"Parker","content-type":"application/json"}',
              },
            },
          },
        },
        { dummyEnd },
      ];
      const expectedResultSize = getJSONBase64Size(spans);

      const actual = JSON.parse(reporter.forgeAndScrubRequestBody(spans, expectedResultSize));
      expect(actual).toEqual(expected);
    });

    test('forgeAndScrubRequestBody - response with error should double payload size', () => {
      const sendTime = 1234;
      const receivedTime = 1256;
      const longString = 'a'.repeat(getEventEntitySize() * 2);

      const dummyEnd = 'dummyEnd';
      const spansSuccess = [
        {
          truncated: false,
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { longString },
                body: longString,
                sendTime,
              },
              response: {
                headers: { longString },
                body: longString,
                statusCode: 200,
                receivedTime,
              },
            },
          },
        },
        { dummyEnd },
      ];
      const spansFail = [
        {
          info: {
            httpInfo: {
              host: 'your.mind.com',
              request: {
                host: 'your.mind.com',
                headers: { longString },
                body: longString,
                sendTime,
              },
              response: {
                headers: { longString },
                body: longString,
                statusCode: 404,
                receivedTime,
              },
            },
          },
        },
        { dummyEnd },
      ];

      const expectedResultSizeSuccess = getJSONBase64Size(spansSuccess);
      const expectedResultSizeFail = getJSONBase64Size(spansFail);

      const spanSuccess = JSON.parse(
        reporter.forgeAndScrubRequestBody(spansSuccess, expectedResultSizeSuccess)
      )[0];
      const spanError = JSON.parse(
        reporter.forgeAndScrubRequestBody(spansFail, expectedResultSizeFail)
      )[0];
      expect(spanError.info.httpInfo.request.body.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.request.body.length * 1.8 + 1
      );
      expect(spanError.info.httpInfo.request.headers.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.request.headers.length * 1.8 + 1
      );
      expect(spanError.info.httpInfo.response.body.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.response.body.length * 1.8 + 1
      );
      expect(spanError.info.httpInfo.response.headers.length).toBeGreaterThan(
        spanSuccess.info.httpInfo.response.headers.length * 1.8 + 1
      );
    });
  });

  test('forgeRequestBody - cut spans', async () => {
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';

    const spans = [{ dummy }, { dummy, error }, { dummyEnd }];
    const expectedResult = [{ dummy, error }, { dummyEnd }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeAndScrubRequestBody(spans, expectedResultSize)).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  test('forgeRequestBody - cut spans - skip initiate stringify (performance boost)', async () => {
    const dummy = { dummy: 'dummy' };
    const spans = new Array(reporter.NUMBER_OF_SPANS_IN_REPORT_OPTIMIZATION + 1).fill({ dummy });

    const spy = jest.spyOn(utils, 'getJSONBase64Size');

    expect(reporter.shouldTrim(spans, 1)).toEqual(true);
    expect(spy).not.toBeCalled();
  });

  test('forgeRequestBody - prune trace off not cutting spans', async () => {
    utils.setPruneTraceOff();
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';
    const spans = [{ dummy }, { dummy, error }, { dummyEnd }];

    expect(reporter.forgeAndScrubRequestBody(spans, 100)).toEqual(JSON.stringify(spans));
    expect(reporter.forgeAndScrubRequestBody([], 100)).toEqual(undefined);
  });

  test('forgeRequestBody - empty list', async () => {
    expect(reporter.forgeAndScrubRequestBody([], 100)).toEqual(undefined);
  });

  test('scrubSpans missing http fields', () => {
    const spans = [
      {
        // span without request and response bodies and headers
        info: {
          httpInfo: {
            host: 'host',
            request: {},
            response: {},
          },
        },
      },
      {
        // missing request and response and host
        info: {
          httpInfo: {},
        },
      },
      { info: {} }, // missing httpInfo
      {}, // missing info
      {
        // missing headers in request and body in response
        info: {
          httpInfo: {
            host: 'host',
            request: {
              body: '',
            },
            response: {
              headers: {},
            },
          },
        },
      },
      {
        // missing host
        info: {
          httpInfo: {
            request: {
              body: '',
              headers: {},
            },
            response: {
              body: '',
              headers: {},
            },
          },
        },
      },
    ];
    scrubSpans(spans);
    expect(spans.length).toEqual(spans.length);
  });

  test('scrubSpans missing http fields (stepFunction)', () => {
    const spans = [
      {
        info: {
          traceId: {
            Root: 'Root',
            Parent: 'Parent',
            Sampled: '0',
            transactionId: 'transactionId',
          },
          httpInfo: { host: 'StepFunction' },
          resourceName: 'StepFunction',
          messageId: 'messageId',
        },
      },
    ];
    const resultSpans = [...spans];
    scrubSpans(spans);
    expect(spans).toEqual(resultSpans);
  });

  test('scrubSpans should not fail after throwing an error', () => {
    const shouldScrubDomainMock = jest
      .spyOn(utils, 'spanHasErrors')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        throw new Error('Error');
      });
    const spanWithoutSecrets = {
      id: '2',
      info: { httpInfo: { request: {}, response: { body: 'body' } } },
    };
    const beforeScrub = [
      {
        id: '1',
        info: {
          httpInfo: {
            request: { host: 'StepFunction' },
            response: {
              headers: { 'content-type': 'json' },
              body: JSON.stringify({ secret: '1234' }),
            },
          },
        },
      },
      spanWithoutSecrets,
      {
        id: '3',
        info: {
          httpInfo: {
            request: {},
            response: {
              headers: { 'content-type': 'json' },
              body: JSON.stringify({ secret: '1234' }),
            },
          },
        },
      },
    ];
    const scrubbed = [
      {
        id: '1',
        info: {
          httpInfo: {
            request: {
              host: 'StepFunction',
            },
            response: {
              headers: '{"content-type":"json"}',
              body: '{"secret":"****"}',
            },
          },
        },
      },
      spanWithoutSecrets,
    ];
    expect(scrubSpans(beforeScrub)).toEqual(scrubbed);
    shouldScrubDomainMock.mockReset();
  });

  test(`sendSpans -> handle errors in forgeAndScrubRequestBody`, async () => {
    setDebug();
    // @ts-ignore
    await sendSpans({});
    //Test that no error is raised

    const logs = ConsoleWritesForTesting.getLogs();
    expect(logs.length).toEqual(2);
    expect(JSON.parse(logs[0].obj).message).toEqual('resultSpans.filter is not a function');
    expect(JSON.parse(logs[0].obj).stack).toBeTruthy();
  });
});
