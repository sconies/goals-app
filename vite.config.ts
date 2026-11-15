import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { faroModules } from './vite.modules.ts';
import { faroHelpIndex } from './vite.helpIndex.ts';

export default defineConfig({
  plugins: [react(), faroModules(), faroHelpIndex()],
  // The import's worker reads the modules' records (a module's own Goals columns, TG2) and loads their readers when it
  // needs them: the same registry, and chunks it can load (it is started as a module worker).
  worker: { format: 'es', plugins: () => [faroModules()] },
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
