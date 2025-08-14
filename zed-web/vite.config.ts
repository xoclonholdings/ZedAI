import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// removed
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:7001',
    },
  },
});
