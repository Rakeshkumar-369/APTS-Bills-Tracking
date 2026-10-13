// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Same-origin /api in development, so the HttpOnly refresh cookie works
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,            // never ship source maps to production
    chunkSizeWarningLimit: 600,  // PDF.js is lazy-loaded; everything else is far smaller
  },
})
