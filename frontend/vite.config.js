import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    base: process.env.VITE_BASE_URL || '/',
    plugins: [react()],

    // Force all React imports to resolve to a single copy.
    resolve: {
      dedupe: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'scheduler'],
    },

    build: {
      chunkSizeWarningLimit: 4000,
      // All node_modules in one chunk — eliminates cross-chunk React errors
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) return 'vendor';
          },
        },
      },
    },

    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
