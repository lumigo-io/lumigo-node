/* eslint-disable */
import { TracerGlobals } from './globals';
import * as reporter from './reporter';
import * as utils from './utils';
import { AxiosMocker } from '../testUtils/axiosMocker';
import { getJSONBase64Size } from './utils';

describe('reporter', () => {
  const basicAnalytics = {
    name: 'global',
    duration: 0,
  }
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
    expect(sentSpans).toEqual([
      [
        {
          e: 'f',
          g: 'h',
          analytics: basicAnalytics,
        },
      ],
    ]);
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
    const spans = [{ dummy }, { dummy }, { dummyEnd, analytics: basicAnalytics }];

    const expectedResult = [{ dummy }, { dummyEnd, analytics: basicAnalytics }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    const actual = reporter.forgeRequestBody(spans, expectedResultSize);
    expect(actual).toEqual(
      JSON.stringify(expectedResult)
    );
  });

  test('forgeRequestBody - cut spans', async () => {
    const dummy = 'dummy';
    const dummyEnd = 'dummyEnd';
    const error = 'error';

    const spans = [{ dummy }, { dummy, error }, { dummyEnd, analytics: basicAnalytics }];
    const expectedResult = [{ dummy, error }, { dummyEnd, analytics: basicAnalytics }];
    const expectedResultSize = getJSONBase64Size(expectedResult);

    expect(reporter.forgeRequestBody(spans, expectedResultSize)).toEqual(
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

    expect(reporter.forgeRequestBody(spans, 100)).toEqual(JSON.stringify(spans));
    expect(reporter.forgeRequestBody([], 100)).toEqual(undefined);
  });

  test('forgeRequestBody - empty list', async () => {
    expect(reporter.forgeRequestBody([], 100)).toEqual(undefined);
  });
});
