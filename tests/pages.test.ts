import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error 書き出しの手順は JS (scripts/prerender.mjs)
import { buildPages, renderPage } from '../scripts/prerender.mjs';
import { commandPageTitle } from '../src/content/commandPages';
import { tableTitle } from '../src/content/compare';
import { fullTitle } from '../src/lib/pageMeta';
import { withSite } from '../src/lib/pageTitle';
import { BASE, parseRoute } from '../src/lib/route';

// 書き出す全ページ (scripts/prerender.mjs の buildPages) を作り、検索に載るページの題名・本文・構造化データを見る
type Page = { path: string; title?: string; noindex?: boolean; canonical?: string; inSitemap?: boolean };
const template = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
let pages: Page[] = [];
let docs: { page: Page; doc: Document; html: string }[] = [];
beforeAll(async () => {
  pages = await buildPages((m: string) => import(/* @vite-ignore */ path.join(process.cwd(), m)));
  docs = pages.map((page) => {
    const html = renderPage(template, page);
    return { page, html, doc: new DOMParser().parseFromString(html, 'text/html') };
  });
}, 60_000);
/** 検索に載るページ (noindex でなく、canonical を別のページに向けていない) */
const indexed = () => docs.filter(({ page }) => !page.noindex && (page.canonical === undefined || page.canonical === page.path));
const len = (s: string) => [...s].length;

describe('書き出す全ページ', () => {
  it('検索に載るページの題名は重ならない (og:title・twitter:title も同じ題名)', () => {
    const seen = new Map<string, string>();
    for (const { page, doc } of indexed()) {
      const t = doc.title;
      expect(seen.get(t), `${page.path} と ${seen.get(t)} の題名が同じ: ${t}`).toBeUndefined();
      seen.set(t, page.path);
      expect(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(t);
      expect(doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(t);
    }
    expect(seen.size).toBeGreaterThan(140);
  });
  it('書き出した題名は、サイトの中で移ったときの document.title (src/lib/route.ts) と同じ', () => {
    // route.ts と同じ分け方: コマンドのページと比較表の表はそれぞれのデータで、ほかは pageMeta で決める
    const client = (p: string) => {
      const r = parseRoute(`${BASE}${p}`);
      if (r.name === 'commands' && r.commandId) return withSite(commandPageTitle(r.commandId));
      if (r.name === 'compare' && r.tableId) return withSite(tableTitle(r.tableId));
      return fullTitle(r);
    };
    // week/1/ はトップと同じ画面で、サイトの中のリンクはトップを指す (canonical もトップ) ので除く
    const diff = docs.filter(({ page }) => page.path !== 'week/1/').filter(({ page, doc }) => client(page.path) !== doc.title).map(({ page, doc }) => [page.path, doc.title, client(page.path)]);
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
  /^(handbook|commands|compare)\/[^/]+\/$/.test(p) ? 'TechArticle' : p === 'glossary/' ? 'DefinedTermSet' : p.startsWith('lesson/') ? 'LearningResource' : undefined;

describe('構造化データとパンくず', () => {
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
    }
  });
  it('第 1 週のレッスンのパンくずは、トップと同じ画面の week/1/ を通らない', () => {
    const l = docs.find((d) => d.page.path === 'lesson/w1-l1/')!;
    expect([...l.doc.querySelectorAll('#root nav a')].map((a) => a.getAttribute('href'))).toEqual(['/kcna-dojo/']);
    const l2 = docs.find((d) => d.page.path.startsWith('lesson/w2-'))!;
    expect([...l2.doc.querySelectorAll('#root nav a')].map((a) => a.getAttribute('href'))).toEqual(['/kcna-dojo/', '/kcna-dojo/week/2/']);
  });
});
