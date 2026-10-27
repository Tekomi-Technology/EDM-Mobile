import { defineConfig } from 'vitest/config';

// Only the parts of the app that do not need React Native (src/offline/engine.ts) are tested here.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
});
