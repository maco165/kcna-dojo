import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error 書き出しの手順は JS (scripts/prerender.mjs)
import { buildPages, renderPage } from '../scripts/prerender.mjs';
import handbookCommands from '../src/content/handbookCommands.json';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { LINE_NOTE_TOPICS, lineNotes } from '../src/content/lineNotes';
import { resolveTitle } from '../src/lib/pageTitle';
import { BASE, parseRoute } from '../src/lib/route';

// 書き出す全ページ (scripts/prerender.mjs の buildPages) を作り、検索に載るページの題名・本文・構造化データを見る
type Page = { path: string; title?: string; noindex?: boolean; canonical?: string; inSitemap?: boolean };
const template = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
let pages: Page[] = [];
let docs: { page: Page; doc: Document; html: string; titles: { title: string; og?: string | null; twitter?: string | null } }[] = [];
beforeAll(async () => {
  pages = await buildPages((m: string) => import(/* @vite-ignore */ path.join(process.cwd(), m)));
  docs = pages.map((page) => {
    const html = renderPage(template, page);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // 題名の抜き出しはここで済ませる (テストの中で 268 ページを読むと、負荷が高いときに 5 秒を超えるため)
    const titles = { title: doc.title, og: doc.querySelector('meta[property="og:title"]')?.getAttribute('content'), twitter: doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') };
    return { page, html, doc, titles };
  });
}, 60_000);
/** 検索に載るページ (noindex でなく、canonical を別のページに向けていない) */
const indexed = () => docs.filter(({ page }) => !page.noindex && (page.canonical === undefined || page.canonical === page.path));
const len = (s: string) => [...s].length;

describe('書き出す全ページ', { timeout: 30_000 }, () => {
  it('検索に載るページの題名は重ならない (og:title・twitter:title も同じ題名)', () => {
    const seen = new Map<string, string>();
    for (const { page, titles } of indexed()) {
      const t = titles.title;
      expect(seen.get(t), `${page.path} と ${seen.get(t)} の題名が同じ: ${t}`).toBeUndefined();
      seen.set(t, page.path);
      expect(titles.og, page.path).toBe(t);
      expect(titles.twitter, page.path).toBe(t);
    }
    expect(seen.size).toBeGreaterThan(140);
  });
  it('設定ファイルのサンプルの名前・全項目・出典を、書き出した本文にも書く', () => {
    const steps = HANDBOOK_TOPICS.flatMap((t) => [...t.flow, ...t.try.flatMap((x) => x.steps)].filter((s) => s.fields).map((s) => ({ t, s })));
    expect(steps.length).toBeGreaterThan(10);
    for (const { t, s } of steps) {
      const { doc } = docs.find(({ page }) => page.path === `handbook/${t.id}/`)!;
      const codes = [...doc.querySelectorAll('dt code, p > code')].map((e) => e.textContent);
      const dds = [...doc.querySelectorAll('dd')].map((e) => e.textContent);
      const hrefs = [...doc.querySelectorAll('dl + p a')].map((a) => a.getAttribute('href'));
      expect(codes).toContain(s.code!.title);
      for (const f of s.fields!.items) {
        expect(codes).toEqual(expect.arrayContaining(f.keys));
        expect(dds).toContain(f.text);
      }
      expect(hrefs).toEqual(expect.arrayContaining(s.fields!.sources));
    }
  });
  it('コマンドの意味と、コマンドのページへのリンクを、書き出した本文にも書く', () => {
    const { doc } = docs.find(({ page }) => page.path === 'handbook/setup-k3s/')!;
    for (const t of HANDBOOK_TOPICS.filter((x) => LINE_NOTE_TOPICS.has(x.id))) {
      const dds = [...docs.find(({ page }) => page.path === `handbook/${t.id}/`)!.doc.querySelectorAll('dd')].map((e) => e.textContent);
      for (const s of [...t.flow, ...t.try.flatMap((x) => x.steps)]) for (const l of lineNotes(t.id, s)) expect(dds, l.code).toContain(l.text);
    }
    const hrefs = [...doc.querySelectorAll('dt a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['curl', 'sh', 'sudo', 'cp', 'kubectl-get'].map((id) => `${BASE}commands/${id}/`)));
  });
  it('書き出した題名は、サイトの中で移ったときの document.title (src/lib/route.ts が使う resolveTitle) と同じ', async () => {
    // week/1/ はトップと同じ画面で、サイトの中のリンクはトップを指す (canonical もトップ) ので除く
    const rows = await Promise.all(docs.filter(({ page }) => page.path !== 'week/1/').map(async ({ page, titles }) => [page.path, titles.title, await resolveTitle(parseRoute(`${BASE}${page.path}`))]));
    const diff = rows.filter(([, a, b]) => a !== b);
    expect(diff).toEqual([]);
  });
  it('どのページの題名も 35 字以内', () => {
    const long = docs.map(({ page, doc }) => [page.path, doc.title, len(doc.title)] as const).filter(([, , n]) => n > 35);
    expect(long).toEqual([]);
  });
});

const ORIGIN_BASE = 'https://maco165.github.io/kcna-dojo/';
type Ld = { '@type': string; url?: string; itemListElement?: { position: number; name: string; item: string }[]; hasDefinedTerm?: unknown[] };
const ldOf = (doc: Document): Ld[] => [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
  const v = JSON.parse(s.textContent ?? '');
  return v['@graph'] ?? [v];
});
/** ページの種類ごとに入れる型 (トップ以外。無いページは BreadcrumbList だけ) */
const expectedType = (p: string) =>
  /^(handbook|commands|compare)\/[^/]+\/$/.test(p) ? 'TechArticle' : p === 'glossary/' ? 'DefinedTermSet' : /^glossary\/[^/]+\/$/.test(p) ? 'DefinedTerm' : p.startsWith('lesson/') ? 'LearningResource' : undefined;

describe('構造化データとパンくず', { timeout: 30_000 }, () => {
  it('検索に載るページは BreadcrumbList と種類ごとの型を持ち、JSON として読めて url が canonical と合う。WebSite はトップだけ', () => {
    for (const { page, doc } of indexed()) {
      const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
      const ld = ldOf(doc);
      expect(ld.map((x) => x['@type']), page.path).not.toContain('WebSite');
      const crumbs = ld.find((x) => x['@type'] === 'BreadcrumbList');
      expect(crumbs, page.path).toBeDefined();
      const items = crumbs!.itemListElement!;
      expect(items[0].item).toBe(ORIGIN_BASE);
      expect(items.at(-1)!.item, page.path).toBe(canonical);
      expect(items.map((x) => x.position)).toEqual(items.map((_, i) => i + 1));
      const type = expectedType(page.path);
      const main = ld.filter((x) => x['@type'] !== 'BreadcrumbList');
      expect(main.map((x) => x['@type']), page.path).toEqual(type ? [type] : []);
      if (type) expect(main[0].url, page.path).toBe(canonical);
    }
    const glossary = ldOf(docs.find((d) => d.page.path === 'glossary/')!.doc).find((x) => x['@type'] === 'DefinedTermSet')!;
    expect(glossary.hasDefinedTerm!.length).toBeGreaterThan(100);
  });
  it('検索に載らないページには構造化データを書かない (WebSite も)', () => {
    for (const { page, doc } of docs.filter((d) => !indexed().includes(d))) expect(ldOf(doc), page.path).toEqual([]);
  });
  it('検索に載るページは、JS なしの本文の頭に、BreadcrumbList と同じ階層の見えるパンくずを持つ', () => {
    for (const { page, doc } of indexed()) {
      const nav = doc.querySelector('#root main > nav[aria-label="パンくず"]:first-child');
      expect(nav, page.path).not.toBeNull();
      const li = [...nav!.querySelectorAll('li')];
      const items = ldOf(doc).find((x) => x['@type'] === 'BreadcrumbList')!.itemListElement!;
      expect(li.map((x) => x.textContent), page.path).toEqual(items.map((x) => x.name));
      // 自分の前までをリンクにし、リンク先は BreadcrumbList の item と同じ
      expect(li.slice(0, -1).map((x) => new URL(x.querySelector('a')!.getAttribute('href')!, ORIGIN_BASE).href)).toEqual(items.slice(0, -1).map((x) => x.item));
      expect(li.at(-1)!.getAttribute('aria-current')).toBe('page');
      // 最後の項目は見出し (h1) と同じ名前 (題名の short ではない)。TechArticle なら headline とも同じ
      const h1 = doc.querySelector('#root h1')!.textContent;
      expect(li.at(-1)!.textContent, page.path).toBe(h1);
      const article = ldOf(doc).find((x) => x['@type'] === 'TechArticle') as { headline?: string } | undefined;
      if (article) expect(article.headline, page.path).toBe(h1);
    }
  });
  it('第 1 週のレッスンのパンくずは、トップと同じ画面の week/1/ を通らない', () => {
    const l = docs.find((d) => d.page.path === 'lesson/w1-l1/')!;
    expect([...l.doc.querySelectorAll('#root nav a')].map((a) => a.getAttribute('href'))).toEqual(['/kcna-dojo/']);
    const l2 = docs.find((d) => d.page.path.startsWith('lesson/w2-'))!;
    expect([...l2.doc.querySelectorAll('#root nav a')].map((a) => a.getAttribute('href'))).toEqual(['/kcna-dojo/', '/kcna-dojo/week/2/']);
  });
});

/** JS なしの本文の字数 (#root の中の文字。script と style を除き、空白を数えない) */
const bodyChars = (doc: Document) => {
  const root = doc.querySelector('#root')!.cloneNode(true) as Element;
  root.querySelectorAll('script, style').forEach((x) => x.remove());
  return (root.textContent ?? '').replace(/\s/g, '').length;
};

describe('JS なしの本文', { timeout: 30_000 }, () => {
  it('検索に載る全ページは 400 字以上 (模擬試験・このサイトについて・全レッスン・週のページを含む)', () => {
    const targets = indexed();
    expect(targets.filter(({ page }) => page.path.startsWith('lesson/')).length).toBeGreaterThanOrEqual(40);
    expect(targets.filter(({ page }) => page.path.startsWith('week/')).length).toBeGreaterThanOrEqual(7);
    const thin = targets.map(({ page, doc }) => [page.path, bodyChars(doc)] as const).filter(([, n]) => n < 400);
    expect(thin).toEqual([]);
  });
  it('模擬試験とこのサイトについての説明は仮の文でない', () => {
    for (const p of ['exam/', 'about/']) {
      const { doc } = docs.find((d) => d.page.path === p)!;
      expect(doc.querySelector('meta[name="description"]')!.getAttribute('content'), p).not.toMatch(/の画面。$/);
    }
    expect(docs.find((d) => d.page.path === 'about/')!.doc.querySelector('#root')!.textContent).toContain('非公式');
  });
  it('検索に載るページは本文を区切る h2 を持つ', () => {
    const none = indexed().filter(({ doc }) => doc.querySelectorAll('#root h2').length === 0).map(({ page }) => page.path);
    expect(none).toEqual([]);
  });
  it('レッスンのページに答えと解説を書かない (画面でも答えるまで出ないため)', async () => {
    const { WEEK_CONTENTS } = await import('../src/content/lessons');
    for (const w of WEEK_CONTENTS) {
      for (const l of w.lessons) {
        if (l.kind !== 'quiz') continue;
        const text = docs.find((d) => d.page.path === `lesson/${l.id}/`)!.doc.querySelector('#root')!.textContent ?? '';
        // 問題データ (問題文・選択肢・候補) にこの語は出ないので、本文に出たら答えを書いている
        expect(text, l.id).not.toMatch(/正解|答え/);
        // 答える前に画面に出るもの (問題文・コード・選択肢・候補)。これに含まれる文は、本文にあっても答えの漏れではない
        const visible = l.questions.flatMap((q) => [q.prompt, ...(q.type === 'choice' ? [q.code?.text ?? '', ...q.choices.map((c) => c.text)] : [q.code, ...(q.candidates ?? [])])]).join('\n');
        for (const q of l.questions) {
          const hidden = [q.explanation, ...(q.type === 'choice' ? q.choices.map((c) => c.why ?? '') : [q.output ?? '', ...Object.values(q.wrongNotes ?? {})])].filter((x) => x.trim().length >= 8 && !visible.includes(x));
          // 書き出しの esc を戻した文字 (textContent) と、文の全体で比べる (innerHTML は " を &quot; にしないので符号で比べない)
          for (const x of hidden) expect(text, q.id).not.toContain(x);
        }
      }
    }
  });
  it('選択肢と候補の並びは正解の位置を見せない (正解がどの位置にも 1/4 ±30% の範囲で来る)', async () => {
    const { WEEK_CONTENTS } = await import('../src/content/lessons');
    const choice = [0, 0, 0, 0];
    const fill = [0, 0, 0, 0];
    for (const w of WEEK_CONTENTS) {
      for (const l of w.lessons) {
        if (l.kind !== 'quiz') continue;
        const items = [...docs.find((d) => d.page.path === `lesson/${l.id}/`)!.doc.querySelectorAll('#root h2 + ol > li')];
        expect(items.length, l.id).toBe(l.questions.length);
        l.questions.forEach((q, i) => {
          if (q.type === 'choice') {
            if (q.fixedOrder) return;
            const shown = [...items[i].querySelectorAll('ul.q-choices > li')].map((x) => x.textContent);
            expect([...shown].sort(), q.id).toEqual(q.choices.map((c) => c.text).sort());
            choice[shown.indexOf(q.choices.find((c) => c.id === q.answer)!.text)]++;
          } else if (q.candidates?.length === 4) {
            const shown = [...items[i].querySelectorAll('ul.q-candidates > li')].map((x) => x.textContent ?? '');
            expect([...shown].sort(), q.id).toEqual([...q.candidates].sort());
            fill[shown.findIndex((x) => q.answers.includes(x))]++;
          }
        });
      }
    }
    for (const [name, counts] of [['4 択', choice], ['穴埋めの候補', fill]] as const) {
      const n = counts.reduce((a, b) => a + b, 0);
      expect(n, name).toBeGreaterThan(80);
      for (const c of counts) expect(Math.abs(c - n / 4), `${name} の正解の位置 ${counts.join('/')}`).toBeLessThanOrEqual((n / 4) * 0.3);
    }
  });
});

// 画面にあるページどうしのつながりを、JS なしの HTML にも書く (検索エンジンがリンクをたどれるように)
describe('JS なしの HTML のページどうしのリンク', { timeout: 30_000 }, () => {
  const hrefs = (root: Document | Element, prefix: string) =>
    [...root.querySelectorAll(root instanceof Element ? 'a[href]' : '#root a[href]')].map((a) => a.getAttribute('href')!).filter((h) => h.startsWith(`${BASE}${prefix}`)).map((h) => h.slice(BASE.length));
  const doc = (p: string) => docs.find(({ page }) => page.path === p)!.doc;
  it('サイトの中へのリンクは、どれも書き出すページを指す (用語集の語は一覧の # を指す)', () => {
    // トップ ('') は index.html そのもの
    const paths = new Set(['', ...pages.map((p) => p.path)]);
    const termIds = new Set([...doc('glossary/').querySelectorAll('dt[id]')].map((d) => d.id));
    const broken = docs.flatMap(({ page, doc: d }) =>
      hrefs(d, '').filter((h) => {
        const [p, hash] = h.split('#');
        return !paths.has(p) || (p === 'glossary/' && hash !== undefined && !termIds.has(hash));
      }).map((h) => `${page.path} → ${h}`),
    );
    expect(broken).toEqual([]);
  });
  it('用語集の語とレッスンは両向きにつながる (語 → 出てくるレッスン、レッスン → 出てくる用語の 1 語のページ)', () => {
    const glossary = doc('glossary/');
    const pairs = [...glossary.querySelectorAll('dt[id]')].flatMap((dt) => hrefs(dt.nextElementSibling!, 'lesson/').map((l) => [dt.id, l] as const));
    expect(pairs.length).toBeGreaterThan(100);
    const missing = pairs.filter(([term, lesson]) => !hrefs(doc(lesson), 'glossary/').includes(`glossary/${term}/`));
    expect(missing).toEqual([]);
    // 1 語のページからも、同じレッスンへ
    const fromPage = pairs.filter(([term, lesson]) => !hrefs(doc(`glossary/${term}/`), 'lesson/').includes(lesson));
    expect(fromPage).toEqual([]);
  });
  it('用語の 1 語のページ: 一覧からリンクされ、canonical は自分、sitemap に載り、DefinedTerm は用語集 (DefinedTermSet) を指す', async () => {
    // @ts-expect-error 書き出しの手順は JS (scripts/prerender.mjs)
    const { sitemap } = await import('../scripts/prerender.mjs');
    const map: string = sitemap(pages);
    const termPages = docs.filter(({ page }) => /^glossary\/[^/]+\/$/.test(page.path));
    expect(termPages.length).toBeGreaterThan(100);
    const listed = new Set(hrefs(doc('glossary/'), 'glossary/'));
    const setLd = ldOf(doc('glossary/')).find((x) => x['@type'] === 'DefinedTermSet') as { '@id'?: string };
    for (const { page, doc: d } of termPages) {
      expect(listed.has(page.path), page.path).toBe(true);
      expect(d.querySelector('link[rel="canonical"]')?.getAttribute('href'), page.path).toBe(`${ORIGIN_BASE}${page.path}`);
      expect(map, page.path).toContain(`<loc>${ORIGIN_BASE}${page.path}</loc>`);
      const term = ldOf(d).find((x) => x['@type'] === 'DefinedTerm') as { inDefinedTermSet?: { '@id'?: string } } | undefined;
      expect(term?.inDefinedTermSet?.['@id'], page.path).toBe(setLd['@id']);
      // 画面と同じ中身: 詳しい説明と出典の節を持つ
      expect([...d.querySelectorAll('#root h2')].map((h) => h.textContent), page.path).toEqual(expect.arrayContaining(['詳しい説明', '出典']));
    }
  });
  it('ハンドブックのトピックとコマンドのページは、問題で練習するレッスンへリンクする', () => {
    const topics = docs.filter(({ page }) => /^handbook\/[^/]+\/$/.test(page.path));
    const commands = docs.filter(({ page }) => /^commands\/[^/]+\/$/.test(page.path));
    const noLesson = (xs: typeof docs) => xs.filter(({ doc: d }) => hrefs(d, 'lesson/').length === 0).map(({ page }) => page.path);
    // 練習するレッスンを持たない付録のトピックとコマンドもあるので、半分より多くがつながっていることと、レッスンの側からの逆向きを見る
    expect(noLesson(topics).length).toBeLessThan(topics.length / 2);
    // 問題に出ないコマンド (handbookCommands.json) はレッスンの代わりに、使うハンドブックのトピックと両向きにつながる
    const own = new Set((handbookCommands as { id: string }[]).map((c) => `commands/${c.id}/`));
    const asked = commands.filter(({ page }) => !own.has(page.path));
    expect(noLesson(asked).length).toBeLessThan(asked.length / 2);
    for (const { page, doc: d } of commands.filter((x) => own.has(x.page.path))) {
      const topicsOf = hrefs(d, 'handbook/').filter((h) => h !== 'handbook/');
      expect(topicsOf.length, page.path).toBeGreaterThan(0);
      for (const h of topicsOf) expect(hrefs(doc(h), 'commands/'), `${h} → ${page.path}`).toContain(page.path);
    }
    const back = commands.flatMap(({ page, doc: d }) => hrefs(d, 'lesson/').filter((l) => !hrefs(doc(l), 'commands/').includes(page.path)).map((l) => `${page.path} ← ${l}`));
    expect(back).toEqual([]);
  });
});
