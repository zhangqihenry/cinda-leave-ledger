import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: './',
  // Personal files under public/ are development fixtures only. Production
  // builds obtain data from Tauri or the Docker API and must never bundle them.
  publicDir: command === 'build' ? false : 'public',
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
}))
