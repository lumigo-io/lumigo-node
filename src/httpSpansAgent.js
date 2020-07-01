import * as logger from './logger';
import { TracerGlobals } from './globals';
import { getEdgeUrl, getJSONBase64Size, getTracerInfo } from './utils';
import axios from 'axios';

export const HttpSpansAgent = (() => {
  let sessionInstance = undefined;

  const validateStatus = () => true;

  const createHeaders = () => {
    const { token } = TracerGlobals.getTracerInputs();
    const { name, version } = getTracerInfo();
    return {
      Authorization: token,
      'User-Agent': `${name}$${version}`,
      'Content-Type': 'application/json',
    };
  };

  const createSessionInstance = (url, headers) => {
    return axios.create({
      baseURL: url,
      timeout: 250,
      maxRedirects: 0,
      headers,
      validateStatus,
    });
  };

  const getSessionInstance = () => {
    if (!sessionInstance) {
      const { url } = getEdgeUrl();
      const headers = createHeaders();
      sessionInstance = createSessionInstance(url, headers);
      logger.debug('Http session created to', {
        url,
        headers,
      });
    }
    return sessionInstance;
  };

  const postSpans = async requestBody => {
    const session = getSessionInstance();
    const bodySize = getJSONBase64Size(requestBody);
    logger.debug('Starting request to edge', { bodySize });
    await session.post('', requestBody).catch(e => {
      logger.debug('Edge error (Tracer skipping)', e.message);
    });
  };

  return { postSpans };
})();
