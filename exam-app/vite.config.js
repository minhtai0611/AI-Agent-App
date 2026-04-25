import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
