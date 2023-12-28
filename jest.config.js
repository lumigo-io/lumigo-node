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
  modulePaths: ['<rootDir>/dist'],
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['./testUtils/jest.setup.js'],
  silent: true,
  watchPathIgnorePatterns: ['globalConfig'],
  runner: 'groups'
};
