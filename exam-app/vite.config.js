import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // WSL2: inotify doesn't fire on /mnt/d -- use polling instead
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    environment: 'node',
  },
})
