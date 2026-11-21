/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages では https://maco165.github.io/kcna-dojo/ に置かれる。
const BASE = '/kcna-dojo/';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // vitest は base を / にするので、テストでも公開と同じ置き場所で経路を作る
    env: { BASE_URL: BASE },
  },
});
