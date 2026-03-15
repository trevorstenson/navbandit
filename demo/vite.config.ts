import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@navbandit': path.resolve(__dirname, '../src'),
    },
  },
})
