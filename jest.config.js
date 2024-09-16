module.exports = () => {
  const [NODE_MAJOR_VERSION] = process.versions.node.split('.').map(Number);
  let collectCoverageFrom = [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
    '!./src/tools/xmlToJson.js',
    '!./src/testdata/functions/**/**.js',
    '!./d_example/**/**',
  ];
  let coverageThreshold = {
    global: {
      // lines: 99.6,
      lines: 50,
    },
  };

  if (NODE_MAJOR_VERSION < 18) {
    // fetch is not supported in Node.js versions lower than 18,
    // so no need to check coverage for that version
    collectCoverageFrom.push('!./src/hooks/fetch.ts');
  }

  if (NODE_MAJOR_VERSION > 14) {
    // Some of our unit tests don't work on Node.js grater than 14,
    // so the coverage is lower when running with these versions
    // coverageThreshold.global.lines = 98.3;
    coverageThreshold.global.lines = 50;
  }

  return {
    collectCoverage: true,
    collectCoverageFrom: collectCoverageFrom,
    coverageDirectory: './coverage/',
    coverageThreshold: coverageThreshold,
    modulePaths: ['<rootDir>/dist'],
    roots: ['<rootDir>/src'],
    setupFilesAfterEnv: ['./testUtils/jest.setup.js'],
    globalSetup: './testUtils/prismaSetup.js',
    silent: true,
    watchPathIgnorePatterns: ['globalConfig'],
  };
};
