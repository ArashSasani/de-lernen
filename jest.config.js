const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  testEnvironment: 'node',
  // Hydrates the fetched-at-runtime corpora from disk; see jest.dataset.ts.
  setupFiles: ['<rootDir>/jest.dataset.ts'],
});
