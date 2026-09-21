import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
    environment: 'node',
    // Las pruebas de migraciones levantan un Postgres en WASM: arrancar lleva unos segundos.
    testTimeout: 30_000,
  },
})
