import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // WoW bridge/Postgres tests use node:test and run via npm run wow:test.
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js', './src/study/tests/unit/setup.ts'],
    // Ordinary UI/unit tests must never use a developer's live profile database.
    env: process.env.PSYCH_STUDY_CLOUD_TEST === '1' ? {} : { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    globals: false,
  },
})
