import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration-test/**/*.integration.test.ts',
    ],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/infrastructure/mongo/models/**',
        'src/config/**',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
