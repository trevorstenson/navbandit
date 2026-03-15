import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@navbandit': path.resolve(__dirname, '../src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        viz: path.resolve(__dirname, 'viz.html'),
      },
    },
  },
})
