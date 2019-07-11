import httpHook from './http';
import { isSwitchedOff, isAwsEnvironment } from '../utils';

export default () => {
  if (!isSwitchedOff() && isAwsEnvironment()) {
    httpHook();
  }
};
