import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data_store.json', '**/data_store.json.tmp'] },
      // Never served (server.ts also refuses every private file at the project root first):
      // Vite's own defaults, plus the database and any credentials export.
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', 'data_store*', '**/*credentials*', 'server.ts'] },
    },
  };
});
