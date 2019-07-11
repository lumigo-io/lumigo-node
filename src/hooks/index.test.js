import * as utils from '../utils';
import httpHook from './http';
import hooksIndex from './index';

jest.mock('../utils');
jest.mock('./http');
describe('hooks index', () => {
  test('index', () => {
    utils.isSwitchedOff.mockReturnValueOnce(false);
    utils.isAwsEnvironment.mockReturnValueOnce(true);
    hooksIndex();
    expect(httpHook).toHaveBeenCalled();

    httpHook.mockClear();

    utils.isSwitchedOff.mockReturnValueOnce(true);
    utils.isAwsEnvironment.mockReturnValueOnce(false);
    hooksIndex();
    expect(httpHook).not.toHaveBeenCalled();
  });
});
