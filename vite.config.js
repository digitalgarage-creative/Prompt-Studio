import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./prompt-studio.html', import.meta.url)),
    },
  },
});
