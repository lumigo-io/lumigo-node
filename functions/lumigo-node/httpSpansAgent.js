var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { HttpsAgent } from 'agentkeepalive';
import * as logger from './logger';
import { TracerGlobals } from './globals';
import { getAgentKeepAlive, getEdgeUrl, getJSONBase64Size, getTracerInfo, isReuseHttpConnection, getConnectionTimeout, getRequestTimeout, } from './utils';
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
    const createSessionInstance = (httpAgent) => {
        const baseConfiguration = { timeout: getRequestTimeout(), maxRedirects: 0, validateStatus };
        if (isReuseHttpConnection()) {
            return axios.create(Object.assign(Object.assign({}, baseConfiguration), { httpsAgent: httpAgent, httpAgent: httpAgent }));
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
    const sendHttpRequest = (url, headers, requestBody) => __awaiter(void 0, void 0, void 0, function* () {
        const connectionTimeout = getConnectionTimeout();
        const session = getSessionInstance();
        let requestTimeoutTimer;
        const requestTimeout = new Promise((resolve) => {
            requestTimeoutTimer = setTimeout(() => {
                clearTimeout(requestTimeoutTimer);
                logger.debug(`Edge connection timeout [${connectionTimeout}ms] from setTimeout (Tracer skipping)`);
                resolve(1);
            }, connectionTimeout);
        });
        const requestPromise = session
            .post(url, requestBody, { headers })
            .then((r) => {
            const { status, statusText, data } = r;
            logger.debug('Edge request completed', { statusText, status, data });
        })
            .catch((e) => {
            logger.debug('Edge error (Tracer skipping)', e.message);
            logger.internalAnalyticsMessage(`report: ${e.message}`);
        });
        yield Promise.race([requestPromise, requestTimeout]).finally(() => {
            clearTimeout(requestTimeoutTimer);
        });
    });
    const postSpans = (requestBody) => __awaiter(void 0, void 0, void 0, function* () {
        const { url } = getEdgeUrl();
        const headers = getHeaders();
        const bodySize = getJSONBase64Size(requestBody);
        logger.debug('Starting request to edge', { url, headers, bodySize });
        yield sendHttpRequest(url, headers, requestBody);
    });
    return { postSpans, cleanSessionInstance, initAgent };
})();
