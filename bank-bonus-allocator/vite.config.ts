import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/bank-bonus-allocator/',
  test: {
    globals: true,
    environment: 'node',
    environmentOptions: {},
    setupFiles: [],
  },
})
