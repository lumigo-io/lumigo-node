import axios from 'axios';

import { getAWSEnvironment } from './utils';

export const SPAN_PATH = 'api/spans';
export const LUMIGO_TRACER_EDGE = 'lumigo-tracer-edge.golumigo.com';

export const getEdgeUrl = () => {
  const { awsRegion } = getAWSEnvironment();
  return `https://${awsRegion}.${LUMIGO_TRACER_EDGE}/${SPAN_PATH}`;
};

export const sendSingleSpan = async span => {
  const { _token } = span;
  const headers = { 'Content-Type': 'application/json', Authorization: _token };
  const edgeUrl = getEdgeUrl();
  const data = JSON.stringify([span]);
  return axios.post(edgeUrl, { headers, data });
};

export const SpansHive = (() => {
  const spans = [];

  const addSpan = span => spans.push(span);
  const getSpans = () => spans;

  return { addSpan, getSpans };
})();
