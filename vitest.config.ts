import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Standalone from vite.config.ts on purpose: the app config carries Tauri-specific
// server/build settings that the test runner has no use for.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
