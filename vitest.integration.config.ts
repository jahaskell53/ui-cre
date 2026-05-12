import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/integration/db/**/*.test.ts'],
    // MSA tests call get_msa_at_point then get_*_by_msa. Postgres sets
    // statement_timeout = 120s on those RPCs; the Vitest wall clock must allow
    // the spatial lookup plus PostgREST overhead on top of the full DB budget,
    // or the harness times out first (see integration-tests on main).
    testTimeout: 180000,
    hookTimeout: 180000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
