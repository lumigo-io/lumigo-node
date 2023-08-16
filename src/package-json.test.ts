import { dirname, join } from 'path';

describe('Lumigo Node dependencies', () => {
  describe.each(['@lumigo/node-core', 'axios', 'shimmer'])(
    'pin specific versions',
    (packageName) => {
      test(`of the ${packageName} package`, () => {
        // Work around the mocking of package.json in <repo_root>/jest.setup.js
        const packageJson = jest.requireActual(join(dirname(__dirname), 'package.json'));

        // Expect something looking like a semver. We want to pin a specific version, rather than using a version range.
        expect(packageJson?.['dependencies']?.[packageName]).toMatch(/^\d+\.\d+.\d+$/);
      });
    }
  );
});
