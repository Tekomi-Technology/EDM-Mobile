import { defineConfig } from 'vitest/config';

// Plain TypeScript runs in Node here; tests of code that uses React Native or Expo mock those modules.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
});
