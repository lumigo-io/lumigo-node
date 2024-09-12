/**
 * Converts the headers object to a key-value pair object.
 * Fetch library uses multiple format to represent headers, this function will convert them all to a key-value pair object.
 * @param {[string, string][] | Record<string, string> | Headers} headers Headers object as used by the fetch library
 * @returns {Record<string, string>} The headers as a key-value pair object
 */
export const convertHeadersToKeyValuePairs = (
  // @ts-ignore
  headers: [string, string][] | Record<string, string> | Headers
): Record<string, string> => {
  // @ts-ignore
  if (headers instanceof Headers) {
    const headersObject: Record<string, string> = {};
    headers.forEach((value, key) => {
      headersObject[key] = value;
    });
    return headersObject;
  }
  if (Array.isArray(headers)) {
    const headersObject: Record<string, string> = {};
    headers.forEach(([key, value]) => {
      headersObject[key] = value;
    });
    return headersObject;
  }

  return headers;
};
