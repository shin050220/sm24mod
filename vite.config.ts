import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages のサブパスでも動くように相対パスでビルドする
export default defineConfig({
  base: './',
  plugins: [react()],
  // Claude SDK を含むため大きめ。個人用アプリなので分割はしない
  build: { chunkSizeWarningLimit: 1000 },
})
