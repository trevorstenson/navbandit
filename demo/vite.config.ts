import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@precog': path.resolve(__dirname, '../src'),
    },
  },
})
