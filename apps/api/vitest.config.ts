import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgresql://calmeter:calmeter@localhost:5432/calmeter_test',
    },
  },
});
