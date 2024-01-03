module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
    '!./src/tools/xmlToJson.js',
    '!./src/testdata/functions/**/**.js',
    '!./d_example/**/**',
  ],
  coverageDirectory: './coverage/',
  coverageThreshold: {
    global: {
      lines: 100,
    },
  },
  modulePaths: ['<rootDir>/dist'],
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['./testUtils/jest.setup.js'],
  globalSetup: './testUtils/prismaSetup.js',
  silent: true,
  watchPathIgnorePatterns: ['globalConfig'],
};
