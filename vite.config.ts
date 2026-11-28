/// <reference types="vitest/config" />
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import postcss from 'postcss';
import react from '@vitejs/plugin-react';
import { codesOf, k3sInstallOf } from './src/lib/stuck';

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
      // ?brief はコマンドの id・名前・短い意味だけ (ハンドブックの「コマンドの意味」が使う。無いコマンドは除く)
      if (query === 'brief' && file.endsWith('.json')) {
        this.addWatchFile(file);
        const data = JSON.parse(await readFile(file, 'utf8'));
        const list: { id: string; command: string; summary: string; absent?: boolean }[] = Array.isArray(data) ? data : data.commands;
        return { code: jsonModule(list.filter((c) => !c.absent).map(({ id: cid, command, summary }) => ({ id: cid, command, summary }))), moduleType: 'js' };
      }
      // ?meta は実践の章の一覧と題名に使う軽い形 (手順は id と OS だけ)。形は src/content/types.ts の HandsOnMeta
      if (query === 'meta' && file.endsWith('.json')) {
        this.addWatchFile(file);
        const c = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown> & { steps: { id: string; os?: string }[] };
        const { id: cid, order, title, short, summary, minutes } = c;
        // k3s は、その章が入れる k3s の版 (「ここで詰まった」の章の版。src/lib/stuck.ts)
        return { code: jsonModule({ id: cid, order, title, short, summary, minutes, k3s: k3sInstallOf(codesOf(c as never)), steps: c.steps.map((s) => ({ id: s.id, os: s.os })) }), moduleType: 'js' };
      }
      if ((query !== 'light' && query !== 'ids') || !file.endsWith('.json')) return null;
      this.addWatchFile(file);
      const week = JSON.parse(await readFile(file, 'utf8')) as { week: number; lessons: Lesson[] & { domain?: string }[] };
      // ?ids は問題の id とレッスンの分野だけ (進捗の画面の到達の数が、模擬試験用の問題の本文を読まないため)
      if (query === 'ids') return jsonModule({ week: week.week, lessons: week.lessons.map((l) => ({ kind: l.kind, domain: (l as { domain?: string }).domain, ids: (l.questions ?? []).map((q) => q.id) })) });
      // 細目 (competency) は最初の画面で使わないので落とす (全文の lessons.ts にはある)
      const lessons = week.lessons.map((l) => (l.kind === 'quiz' ? (({ competency: _c, ...rest }) => ({ ...rest, questions: l.questions!.map(({ id: qid, type, prompt }) => ({ id: qid, type, prompt })) }))(l as Lesson & { competency?: string }) : l));
      return jsonModule({ week: week.week, lessons });
    },
  };
}

/** データの JSON を、オブジェクトの書き方ではなく JSON.parse の文字列にした module にする (V8 は大きなデータを JSON.parse のほうが速く読む) */
const jsonModule = (data: unknown) => `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;

/**
 * src/content の JSON (問題・ハンドブック・用語集・コマンドなど) を JSON.parse の module で読む。
 * vite の既定はオブジェクトの書き方の JS にするので、開いたときにデータの読み込みが長いタスクになっていた (スマホの Lighthouse)。
 * どの JSON も default で取り込む (名前つきの取り込みはしない)
 */
function jsonParse(): Plugin {
  return {
    name: 'kcna-json-parse',
    enforce: 'pre',
    async load(id) {
      if (id.includes('?') || !id.endsWith('.json') || !id.includes('/src/content/')) return null;
      this.addWatchFile(id);
      // moduleType: 'js' で、vite の JSON の変換に回さない
      return { code: jsonModule(JSON.parse(await readFile(id, 'utf8'))), moduleType: 'js' };
    },
  };
}

/** StyleX が作る原子的なクラスの名前 (x と英数字) */
const STYLEX_CLASS = /\.(x[a-z0-9]{4,10})(?![\w-])/g;
const STYLEX_TOKEN = /\bx[a-z0-9]{4,10}\b/g;
const ASTRYX_IMPORT = /["'](@astryxdesign\/core\/[^"']+)["']/g;
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await sourceFiles(p)));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Astryx の CSS (全部の部品の StyleX の CSS が 1 つになった astryx.css) から、このサイトが使う部品のどこにも出てこない
 * クラスだけの規則を除く (スマホの Lighthouse で、描画を止める CSS が 280KB あった)。
 * 使う部品は src の '@astryxdesign/core/…' の取り込みから、部品の中の取り込みをたどって集める (木を揺すって落とす前の
 * 全部なので、使うクラスを落とさない側に倒れる)。CSS を読む時点で決めるので、出力の名前の hash も消したあとの中身で決まる。
 * 消すのは「すべての StyleX のクラスが部品のコードに無い」セレクタだけで、@property・@keyframes・ほかの規則は残す
 */
function purgeStylex(): Plugin {
  return {
    name: 'kcna-purge-stylex',
    apply: 'build',
    async transform(code, id) {
      if (!id.split('?')[0].endsWith('/@astryxdesign/core/dist/astryx.css')) return null;
      const used = new Set<string>();
      const seen = new Set<string>();
      const queue: string[] = [];
      // 解決できない書き方 (コメントの中の例など) は飛ばす。本当の取り込みなら組み立ての本体が失敗する
      const resolve = async (spec: string, from: string) => {
        try {
          return (await this.resolve(spec, from))?.id;
        } catch {
          return undefined;
        }
      };
      const add = (file: string | undefined) => {
        if (file && !seen.has(file) && file.endsWith('.js')) {
          seen.add(file);
          queue.push(file);
        }
      };
      for (const file of await sourceFiles(path.resolve(__dirname, 'src'))) {
        for (const m of (await readFile(file, 'utf8')).matchAll(ASTRYX_IMPORT)) if (!m[1].endsWith('.css')) add(await resolve(m[1], file));
      }
      while (queue.length > 0) {
        const file = queue.pop()!;
        const text = await readFile(file, 'utf8');
        for (const m of text.matchAll(STYLEX_TOKEN)) used.add(m[0]);
        for (const m of text.matchAll(RELATIVE_IMPORT)) add(path.resolve(path.dirname(file), m[1]));
        for (const m of text.matchAll(ASTRYX_IMPORT)) if (!m[1].endsWith('.css')) add(await resolve(m[1], file));
      }
      if (seen.size === 0) return null;
      const root = postcss.parse(code);
      root.walkRules((rule) => {
        if (rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as postcss.AtRule).name)) return;
        const kept = rule.selectors.filter((sel) => [...sel.matchAll(STYLEX_CLASS)].every((m) => used.has(m[1])));
        if (kept.length === 0) rule.remove();
        else if (kept.length < rule.selectors.length) rule.selectors = kept;
      });
      // 中身の無くなった @media などは除く
      root.walkAtRules((at) => {
        if (at.nodes && at.nodes.length === 0) at.remove();
      });
      return { code: root.toString(), map: null };
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [lightLessons(), jsonParse(), purgeStylex(), react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // vitest は base を / にするので、テストでも公開と同じ置き場所で経路を作る
    env: { BASE_URL: BASE },
  },
});
