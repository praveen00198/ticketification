import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Raise warning threshold — individual chunks will still be well-split
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core runtime
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // Lucide icons — large icon tree
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
          // QR scanner / html5-qrcode
          if (
            id.includes('node_modules/html5-qrcode') ||
            id.includes('node_modules/qr-scanner')
          ) {
            return 'vendor-scanner';
          }
          // Axios / api clients
          if (id.includes('node_modules/axios')) {
            return 'vendor-axios';
          }
        },
      },
    },
  },
});
