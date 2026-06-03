import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/medischedule-api': {
        target: 'https://medischedule.kr/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/medischedule-api/, ''),
      },
      '/mentoring-api': {
        target: 'https://mentoring-api-6l1a.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/mentoring-api/, ''),
      },
      '/penalty-api': {
        target: 'https://medipenalty.kr/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/penalty-api/, ''),
      },
    },
  },
});
