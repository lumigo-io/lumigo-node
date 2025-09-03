import { runOneTimeWrapper } from './functionUtils';

describe('functionUtils', () => {
  test('runOneTime -> simple flow', () => {
    let i = 0;
    const addToI = () => {
      i++;
    };
    const wrappedAddToI = runOneTimeWrapper(addToI, this);
    wrappedAddToI();
    wrappedAddToI();

    expect(i).toEqual(1);
  });

  test('runOneTime -> without context', () => {
    let i = 0;
    const addToI = () => {
      i++;
    };
    const wrappedAddToI = runOneTimeWrapper(addToI);
    wrappedAddToI();
    wrappedAddToI();

    expect(i).toEqual(1);
  });

  test('runOneTime -> return value', () => {
    let i = 0;
    const addToI = () => {
      i++;
      return 'OK';
    };
    const wrappedAddToI = runOneTimeWrapper(addToI, this);
    const retValue = wrappedAddToI();
    wrappedAddToI();

    expect(i).toEqual(1);
    expect(retValue).toEqual('OK');
  });

  test('runOneTime -> use params', () => {
    let i = 0;
    const addToI = (count) => {
      i += count;
      return 'OK';
    };
    const wrappedAddToI = runOneTimeWrapper(addToI, this);
    wrappedAddToI(5);
    wrappedAddToI(10);

    expect(i).toEqual(5);
  });
});
