import MockAdapter from 'axios-mock-adapter';

export const AxiosMocker = (() => {
  let axiosMocker = undefined;

  const createAxiosMocker = axiosLib => {
    axiosMocker = new MockAdapter(axiosLib);
  };

  const getAxiosMocker = () => axiosMocker;

  const getRequests = () => axiosMocker.history.post;

  const getSentSpans = () => getRequests().map(r => JSON.parse(r.data));

  const clean = () => {
    axiosMocker.reset();
  };

  return { createAxiosMocker, getAxiosMocker, getRequests, getSentSpans, clean };
})();
