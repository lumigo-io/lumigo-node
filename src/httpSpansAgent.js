import * as logger from './logger';
import { TracerGlobals } from './globals';
import {
  getEdgeUrl,
  getJSONBase64Size,
  getTracerInfo,
  isReuseHttpConnection,
  getConnectionTimeout,
} from './utils';
import axios from 'axios';

const REQUEST_TIMEOUT = 250;

export const HttpSpansAgent = (() => {
  let sessionInstance;
  let sessionAgent;
  let headersCache;

  const validateStatus = () => true;

  const getHeaders = () => {
    if (!headersCache) {
      const { token } = TracerGlobals.getTracerInputs();
      const { name, version } = getTracerInfo();
      headersCache = {
        Authorization: token,
        'User-Agent': `${name}$${version}`,
        'Content-Type': 'application/json',
      };
    }
    return headersCache;
  };

  const initAgent = () => {
    sessionInstance = createSessionInstance(sessionAgent);
    logger.debug('Http session created to');
  };

  const createSessionInstance = () => {
    const baseConfiguration = { timeout: REQUEST_TIMEOUT, maxRedirects: 0, validateStatus };
    if (isReuseHttpConnection()) {
      return axios.create({
        ...baseConfiguration,
        rejectUnauthorized: false,
      });
    }
    return axios.create(baseConfiguration);
  };

  const getSessionInstance = () => {
    if (!sessionInstance) {
      sessionInstance = createSessionInstance();
    }
    return sessionInstance;
  };

  const cleanSessionInstance = () => {
    sessionInstance = undefined;
  };

  const sendHttpRequest = async (url, headers, requestBody) => {
    const connectionTimeout = getConnectionTimeout();
    const session = getSessionInstance();
    let requestTimeoutTimer;
    const requestTimeout = new Promise(resolve => {
      requestTimeoutTimer = setTimeout(() => {
        clearTimeout(requestTimeoutTimer);
        logger.debug(
          `Edge connection timeout [${connectionTimeout}ms] from setTimeout (Tracer skipping)`
        );
        resolve(1);
      }, connectionTimeout);
    });
    const requestPromise = session
      .post(url, requestBody, { headers })
      .then(r => {
        const { status, statusText, data } = r;
        logger.debug('Edge request completed', { statusText, status, data });
      })
      .catch(e => {
        logger.debug('Edge error (Tracer skipping)', e.message);
      });

    await Promise.race([requestPromise, requestTimeout]).finally(() => {
      clearTimeout(requestTimeoutTimer);
    });
  };

  const postSpans = async requestBody => {
    const { url } = getEdgeUrl();
    const headers = getHeaders();
    const bodySize = getJSONBase64Size(requestBody);

    logger.debug('Starting request to edge', { url, headers, bodySize });
    await sendHttpRequest(url, headers, requestBody);
  };

  return { postSpans, cleanSessionInstance, initAgent };
})();
