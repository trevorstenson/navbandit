import { defineConfig } from 'tsup'

export default defineConfig({
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
})
