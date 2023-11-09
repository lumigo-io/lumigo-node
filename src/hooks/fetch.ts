import * as url from 'url';
import * as extender from '../extender';
import { SpansContainer, TracerGlobals } from '../globals';
import { FETCH_SPAN, getBasicChildSpan, getCurrentTransactionId } from '../spans/awsSpan';
import { getRandomId } from '../utils';
import { payloadStringify } from '../utils/payloadStringify';

export const beforeFetch = (args: any[], extenderContext: any) => {
  extenderContext.spanId = getRandomId();

  const fetchUrl = args[0];
  let requestUrl: url.UrlWithParsedQuery | undefined;
  try {
    requestUrl = url.parse(fetchUrl, true);
  } catch (e) {
    console.debug('parse url error', e);
  }
  const options = args[1] || {};
  const method = options.method || 'GET';

  const httpInfo = {
    route: requestUrl?.pathname,
    host: requestUrl?.host,
    url: payloadStringify(fetchUrl),
    method,
  };

  // https://developer.mozilla.org/en-US/docs/Web/API/fetch
  const span = {
    ...getBasicChildSpan(
      getCurrentTransactionId(),
      TracerGlobals.getHandlerInputs().context.awsRequestId,
      extenderContext.spanId,
      FETCH_SPAN
    ),
    options: payloadStringify(options),
    started: Date.now(),
  };

  for (const key in httpInfo) {
    span[`info.httpInfo.${key}`] = httpInfo[key];
  }

  if (options.headers) {
    try {
      const headers = {};
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
      span['http.request.headers'] = payloadStringify(headers);
    } catch (e) {
      span['http.request.headers'] = payloadStringify(options.headers);
    }
  }

  if (options.body) {
    span['http.request.body'] = payloadStringify(options.body);
  }

  SpansContainer.addSpan(span);
};

const getResponseBody = async (result: any): Promise<string | undefined> => {
  try {
    const json = await result.json();
    return payloadStringify(json);
  } catch (err) {
    try {
      const text = await result.text();
      return payloadStringify(text);
    } catch (err) {
      console.log('fetch response body parse error', err);
    }
  }
  return undefined;
};

export const afterFetch = (args: any[], originalFnResult: any, extenderContext: any) => {
  const currentSpan = SpansContainer.getSpanById(extenderContext.spanId);
  // @ts-ignore
  currentSpan.ended = Date.now();
  originalFnResult.then(async (result: any) => {
    // @ts-ignore
    currentSpan['http.status_code'] = result.status;

    if (result.headers) {
      let headers = undefined;
      for (const [key, value] of result.headers) {
        headers = headers || {};
        headers[key] = value;
      }
      if (headers) {
        currentSpan['http.response.headers'] = payloadStringify(headers);
      }
    }

    const responseBody = await getResponseBody(result);
    if (result.ok) {
      if (responseBody) {
        currentSpan['http.response.body'] = responseBody;
      }
    } else {
      if (result.statusText) {
        if (responseBody) {
          // @ts-ignore
          currentSpan.error = `${result.statusText}: ${responseBody}`;
        } else {
          // @ts-ignore
          currentSpan.error = result.statusText;
        }
      } else {
        if (responseBody) {
          // @ts-ignore
          currentSpan.error = responseBody;
        }
      }
    }

    SpansContainer.addSpan(currentSpan);
  });
};

export const hookFetch = () => {
  try {
    extender.hook(global, 'fetch', {
      beforeHook: beforeFetch,
      afterHook: afterFetch,
    });
  } catch (e) {
    console.log('hook fetch error', e);
  }
};
