// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
  // Use the test-specific TypeScript config
  typescript: {
    configFile: './tsconfig.test.json'
  }
})

// Add any custom config to be passed to Jest for functional tests
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node', // Use node environment for functional tests
  testMatch: [
    '<rootDir>/src/__tests__/functional/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/__tests__/**/functional-*.test.{js,jsx,ts,tsx}'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Don't ignore functional tests in this config
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  // Increase timeout for functional tests
  testTimeout: 60000,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
