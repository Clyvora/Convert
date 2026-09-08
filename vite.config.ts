import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


const productionHeaders = Object.fromEntries(JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers[0].headers.map((header: { key: string; value: string }) => [header.key, header.value]))

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    proxy: {
      '/api/v1/convert/media/resolve': {
        target: 'https://api.clyvora.tech', changeOrigin: true,
        rewrite: () => '/v1/media/resolve',
        headers: { Origin: 'https://www.convert.clyvora.tech' },
      },
    },
    headers: {
      ...productionHeaders,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
