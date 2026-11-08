import { defineConfig } from 'vitest/config';
import { faroModules } from '../vite.modules.ts';

export default defineConfig({
  plugins: [faroModules()],
  test: {
    include: ['evals/**/*.eval.ts'],
    environment: 'node',
    // The scenarios run beside the smoke journeys' browsers (backlog -1), so a database scenario that takes 3 seconds
    // alone can take more than vitest's default 5 on a busy runner (TELEMETRY-RETENTION did, in CI on PR #41).
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
