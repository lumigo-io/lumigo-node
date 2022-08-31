import { getW3CMessageId } from '../utils/w3cUtils';

export const W3CParser = (requestData) => {
  const { headers: reqHeaders } = requestData;
  const messageId = getW3CMessageId(reqHeaders);
  return { messageId };
};
