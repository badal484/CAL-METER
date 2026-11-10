import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^react-native$/,
        replacement: path.resolve(__dirname, './tests/mocks/react-native.ts'),
      },
      {
        find: /^react-native\/(.*)$/,
        replacement: path.resolve(__dirname, './tests/mocks/react-native.ts'),
      },
      {
        find: 'react-native-safe-area-context',
        replacement: path.resolve(__dirname, './tests/mocks/react-native-safe-area-context.ts'),
      },
      {
        find: 'react-native-svg',
        replacement: path.resolve(__dirname, './tests/mocks/react-native-svg.ts'),
      },
      {
        find: 'react-native-camera-kit',
        replacement: path.resolve(__dirname, './tests/mocks/react-native-camera-kit.ts'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    server: {
      deps: {
        inline: [
          /react-native/,
          /react-native-safe-area-context/,
          /react-native-svg/,
          /react-native-camera-kit/,
        ],
      },
    },
  },
});
