module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '<rootDir>/src/background/auth/',
    '<rootDir>/src/background/cacheManager.js',
    '<rootDir>/src/background/commandRegister.js',
    '<rootDir>/src/background/salesforceUtils.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
