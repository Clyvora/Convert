import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['src/**/*.browser.test.ts', '**/node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true,
    restoreMocks: true,
    coverage: { reporter: ['text', 'html'] },
  },
})
