import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    // В разработке фронтенд работает на своём порту и ходит в API бекенда через прокси.
    proxy: {
      // Только сам API: адрес интерфейса вроде /api-docs остаётся фронтенду.
      '^/api(/|$)': 'http://localhost:3000',
    },
  },
})
