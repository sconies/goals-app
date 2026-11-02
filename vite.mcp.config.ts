/* Builds the MCP server (server/vercel.ts) into one self-contained file, api/mcp.js, which Vercel runs as /api/mcp. */
import { defineConfig } from 'vite';

export default defineConfig({
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'server/vercel.ts',
    outDir: 'api',
    emptyOutDir: false,
    minify: false,
    target: 'node20',
    copyPublicDir: false,
    rolldownOptions: { output: { entryFileNames: 'mcp.js', format: 'es', codeSplitting: false } },
  },
});
