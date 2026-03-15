import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      sw: 'src/sw.ts',
      client: 'src/client.ts',
      fallback: 'src/fallback.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2020',
  },
  {
    entry: {
      navbandit: 'src/standalone.ts',
    },
    format: ['esm', 'iife'],
    globalName: 'NavBandit',
    minify: true,
    clean: false,
    sourcemap: true,
    target: 'es2020',
  },
])
