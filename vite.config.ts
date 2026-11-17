/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages では https://maco165.github.io/kcna-dojo/ に置かれる。
export default defineConfig({
  base: '/kcna-dojo/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
