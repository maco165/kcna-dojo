/// <reference types="vitest/config" />
import { readFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages では https://maco165.github.io/kcna-dojo/ に置かれる。
const BASE = '/kcna-dojo/';

type Lesson = { kind: string; questions?: { id: string; type: string; prompt: string }[] };

/**
 * 週の問題のファイルを ?light を付けて読むと、問題を id・形・問題文だけにした軽い形で返す
 * (ホームと本体が使う。最初に読む JS に選択肢・解説・出典の全文を入れないため。形は src/content/types.ts の WeekIndex)
 */
function lightLessons(): Plugin {
  return {
    name: 'kcna-light-lessons',
    enforce: 'pre',
    async load(id) {
      const [file, query] = id.split('?');
      if (query !== 'light' || !file.endsWith('.json')) return null;
      this.addWatchFile(file);
      const week = JSON.parse(await readFile(file, 'utf8')) as { week: number; lessons: Lesson[] };
      const lessons = week.lessons.map((l) => (l.kind === 'quiz' ? { ...l, questions: l.questions!.map(({ id: qid, type, prompt }) => ({ id: qid, type, prompt })) } : l));
      return `export default ${JSON.stringify({ week: week.week, lessons })};`;
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [lightLessons(), react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // vitest は base を / にするので、テストでも公開と同じ置き場所で経路を作る
    env: { BASE_URL: BASE },
  },
});
