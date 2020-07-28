import { HttpsAgent } from 'agentkeepalive';
import * as logger from './logger';
import { TracerGlobals } from './globals';
import {
  getAgentKeepAlive,
  getEdgeUrl,
  getJSONBase64Size,
  getTracerInfo,
  isReuseHttpConnection,
} from './utils';
import axios from 'axios';

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
    sessionAgent = createHttpAgent();
    sessionInstance = createSessionInstance(sessionAgent);
    logger.debug('Http session created to');
  };

  const createHttpAgent = () => {
    const timeout = getAgentKeepAlive() || 900000;
    return new HttpsAgent({
      maxSockets: 5,
      maxFreeSockets: 5,
      timeout: timeout,
      freeSocketTimeout: timeout,
    });
  };

  const createSessionInstance = httpAgent => {
    const baseConfiguration = { timeout: 250, maxRedirects: 0, validateStatus };
    if (isReuseHttpConnection()) {
      return axios.create({
        ...baseConfiguration,
        httpsAgent: httpAgent,
        httpAgent: httpAgent,
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

  const postSpans = async requestBody => {
    const { url } = getEdgeUrl();
    const headers = getHeaders();

    const session = getSessionInstance();

    const bodySize = getJSONBase64Size(requestBody);

    logger.debug('Starting request to edge', { url, headers, bodySize });
    await session.post(url, requestBody, { headers }).catch(e => {
      logger.debug('Edge error (Tracer skipping)', e.message);
    });
  };

  return { postSpans, cleanSessionInstance, initAgent };
})();
