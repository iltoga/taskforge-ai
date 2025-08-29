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

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/src/__tests__/functional/functional-kitas-query.test.ts'
    // Removed ignore for functional tests to allow running them
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(next-auth|@auth|@ai-sdk|@openrouter|@modelcontextprotocol|next-auth|@next-auth|next-auth\\/providers|next-auth\\/core|next-auth\\/react|next-auth\\/jwt|next-auth\\/adapters|next-auth\\/client|next-auth\\/utils|next-auth\\/types|next-auth\\/errors|next-auth\\/middleware|next-auth\\/session|next-auth\\/config|next-auth\\/lib|next-auth\\/src|next-auth\\/index|next-auth\\/package|next-auth\\/dist|next-auth\\/next|next-auth\\/webauthn)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-markdown$': '<rootDir>/src/__mocks__/react-markdown.tsx',
    '^rehype-raw$': '<rootDir>/src/__mocks__/rehype-raw.tsx',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',
    '!src/app/**/loading.tsx',
    '!src/app/**/error.tsx',
    '!src/app/**/not-found.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
