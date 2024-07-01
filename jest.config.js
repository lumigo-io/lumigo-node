module.exports = () => {
  const [NODE_MAJOR_VERSION] = process.versions.node.split('.').map(Number);
  let collectCoverageFrom = [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
    '!./src/tools/xmlToJson.js',
    '!./src/testdata/functions/**/**.js',
    '!./d_example/**/**',
  ];
  if (NODE_MAJOR_VERSION < 18) {
    collectCoverageFrom.push('!./src/hooks/fetch.ts');
  }
  return {
    collectCoverage: true,
    collectCoverageFrom: collectCoverageFrom,
    coverageDirectory: './coverage/',
    coverageThreshold: {
      global: {
        lines: 99.7,
      },
    },
    modulePaths: ['<rootDir>/dist'],
    roots: ['<rootDir>/src'],
    setupFilesAfterEnv: ['./testUtils/jest.setup.js'],
    globalSetup: './testUtils/prismaSetup.js',
    silent: true,
    watchPathIgnorePatterns: ['globalConfig'],
  };
};
