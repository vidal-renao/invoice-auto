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
    // `testTimeout` no cubre beforeAll/afterAll, y ahí es justo donde se crea la
    // base de datos. Con varias suites en paralelo, el arranque pasa de los 10 s
    // por defecto y la suite falla sin que nada esté roto.
    hookTimeout: 120_000,
  },
})
