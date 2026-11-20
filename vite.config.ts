import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // 使用相對路徑，讓網站放在 GitHub Pages 子路徑（帳號.github.io/專案名稱/）也能正常載入
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      // LINE / FB 預覽圖需要完整網址；GitHub Actions 部署時會自動帶入 SITE_URL
      name: 'site-url',
      transformIndexHtml: html => html.replaceAll('__SITE_URL__', process.env.SITE_URL ?? './'),
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // 兼顧較舊的手機瀏覽器（含 LINE 內建瀏覽器）
    target: ['es2020', 'safari14'],
  },
});
