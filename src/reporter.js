import got from 'got';

import { getAWSEnvironment } from './utils';

export const SPAN_PATH = 'api/spans';
export const LUMIGO_TRACER_EDGE = 'lumigo-tracer-edge.golumigo.com';

// XXX Use an option to set the host (for testing)
export const getEdgeUrl = () => {
  //const { awsRegion } = getAWSEnvironment();
  return 'https://kzc0w7k50d.execute-api.eu-west-1.amazonaws.com/api/spans';
  //return 'https://qdmqfep5c1.execute-api.eu-west-1.amazonaws.com/api/spans ';
  //return `https://${awsRegion}.${LUMIGO_TRACER_EDGE}/${SPAN_PATH}`;
};

export const sendSingleSpan = async span => sendSpans([span]);

export const sendSpans = async spans => {
  const { token } = spans[0];
  const headers = { 'Content-Type': 'application/json', Authorization: token };
  const edgeUrl = getEdgeUrl();
  const body = JSON.stringify(spans);
  await got.post(edgeUrl, { headers, body });
};

export const SpansHive = (() => {
  const spans = [];

  const addSpan = span => spans.push(span);
  const getSpans = () => spans;

  return { addSpan, getSpans };
})();
