import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :5000. Proxying /api keeps everything same-origin,
// so HttpOnly cookies work without any CORS / third-party cookie problems.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_DEV_API || 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: process.env.VITE_DEV_API || 'http://localhost:5000', changeOrigin: true, ws: true },
    },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
