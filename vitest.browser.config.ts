import { existsSync } from 'node:fs'
import { playwright } from '@vitest/browser-playwright'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const browserCandidates = process.platform === 'win32'
  ? [
      'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ]
  : []
const executablePath = process.env.BROWSER_EXECUTABLE_PATH
  ?? browserCandidates.find((candidate) => existsSync(candidate))

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    include: ['src/**/*.browser.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ launchOptions: executablePath ? { executablePath } : undefined }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
