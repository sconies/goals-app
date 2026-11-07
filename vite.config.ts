import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Node by default (quicker to start); a test that needs a browser says so: // @vitest-environment jsdom.
    environment: 'node',
    // Test files share workers instead of starting one each (about 5 seconds quicker). A test that changes something
    // global puts it back, as every test here does.
    isolate: false,
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
});
