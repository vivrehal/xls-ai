import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/upload': process.env.VITE_API_URL || 'http://localhost:4000',
      '/files': process.env.VITE_API_URL || 'http://localhost:4000',
      '/query': process.env.VITE_API_URL || 'http://localhost:4000'
    }
  },
  build: {
    outDir: 'dist'
  }
});
