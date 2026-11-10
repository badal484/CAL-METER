import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, './tests/mocks/react-native.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
