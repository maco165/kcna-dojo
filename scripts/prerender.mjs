// 作ったあと (vite build のあと) に、ページごとの index.html を dist に書き出す。
// 検索エンジンと SNS が JS を動かさなくても、題名・説明・canonical・本文を読めるようにする。
// 本文は画面に出るものと同じ中身 (問題の答えと解説は、画面でも答えるまで出ないので書かない)。
// 画面を描くと #root の中身は React が置き換える。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
export const ORIGIN = 'https://maco165.github.io';
export const BASE = '/kcna-dojo/';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (p) => `${ORIGIN}${BASE}${p}`;
const link = (p, text) => `<a href="${BASE}${p}">${esc(text)}</a>`;
const clip = (s, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * 型の中の置き換える場所。合わなければ書き出しを止める (index.html の形が変わったのに、
 * 全ページの canonical がトップのまま公開される、といったことを防ぐ)
 */
const SLOTS = {
  title: /<title>[^<]*<\/title>/,
  description: /(<meta name="description" content=")[^"]*(")/,
  canonical: /(<link rel="canonical" href=")[^"]*(")/,
  ogUrl: /(<meta property="og:url" content=")[^"]*(")/,
  ogTitle: /(<meta property="og:title" content=")[^"]*(")/,
  ogDescription: /(<meta property="og:description" content=")[^"]*(")/,
  twitterTitle: /(<meta name="twitter:title" content=")[^"]*(")/,
  twitterDescription: /(<meta name="twitter:description" content=")[^"]*(")/,
  root: /<div id="root">[\s\S]*?<\/div>\s*(?=<script|<\/body>)/,
};

/** dist/index.html を型にして、1 ページ分の HTML を作る。置き換えは関数で渡す ($1 などを置き換えの記号として読ませない) */
export function renderPage(template, { path: p, title, description, body, noindex = false, canonical }) {
  const full = title ? `${title} | クラネイ — KCNA-JP 対策` : 'クラネイ — KCNA-JP 対策';
  const can = url(canonical ?? p);
  const attr = (v) => (_, a, b) => `${a}${v}${b}`;
  const set = {
    title: () => `<title>${esc(full)}</title>`,
    description: attr(esc(description)),
    canonical: attr(can),
    ogUrl: attr(url(p)),
    ogTitle: attr(esc(full)),
    ogDescription: attr(esc(description)),
    twitterTitle: attr(esc(full)),
    twitterDescription: attr(esc(description)),
    root: () => `<div id="root">\n      <main class="prerender">\n${body}\n      </main>\n    </div>\n    `,
  };
  let html = template;
  for (const [k, re] of Object.entries(SLOTS)) {
    if (!re.test(html)) throw new Error(`prerender: index.html に ${k} の場所が見つかりません (index.html の形が変わったら SLOTS を直す)`);
    html = html.replace(re, set[k]);
  }
  if (noindex) html = html.replace('</title>', () => '</title>\n    <meta name="robots" content="noindex" />');
  return html;
}

/** すべてのページ (経路・題名・説明・本文・検索に載せるか) を、画面と同じデータから作る */
export async function buildPages(load) {
  const { pageTitle } = await load('/src/lib/pageMeta.ts');
  const { parseRoute } = await load('/src/lib/route.ts');
  const titleOf = (p) => pageTitle(parseRoute(`${BASE}${p}`));
  const { WEEKS } = await load('/src/content/curriculum.ts');
  const { HANDBOOK_PARTS, HANDBOOK_TOPICS, isAppendixDomain, sectionName: shortName } = await load('/src/content/handbook.ts');
  const sectionName = (d) => (isAppendixDomain(d) ? `${shortName(d)} (資格の範囲の外)` : d);
  const { CURRICULUM, DEFINITION } = await load('/src/content/guide.ts');
  const glossary = (await load('/src/content/glossary.json')).default;
  const pages = [];
  const lessonsOf = (w) => w.content?.lessons ?? [];

  // 説明のページ
  pages.push({
    path: 'guide/',
    title: 'Kubernetes とこのサイト',
    description: 'KCNA-JP の試験の目的と形式、出題範囲 (学習要領の 4 分野と細目)、このサイトの問題の作り方と出典をまとめたページ。',
    body: [
      '<h1>Kubernetes とこのサイト</h1>',
      `<p>${esc(DEFINITION)}</p>`,
      '<h2>出題範囲 (学習要領)</h2>',
      ...CURRICULUM.map((c) => `<h3>${esc(c.domain)}</h3><ul>${c.competencies.map((x) => `<li>${esc(x.ja)} (${esc(x.en)})</li>`).join('')}</ul>`),
      `<p>${link('handbook/', 'ハンドブック')}・${link('glossary/', '用語集')}</p>`,
    ].join('\n'),
  });

  // ハンドブック
  pages.push({
    path: 'handbook/',
    title: 'ハンドブック',
    description: 'KCNA の学習要領の細目ごとに、公式のドキュメントに沿って、kubectl のコマンドと出力の例で全体の流れを説明する参照ページ。k3s で試す手順と後片付けつき。',
    body: [
      '<h1>ハンドブック</h1>',
      // 画面と同じく 2 部 (h2) に分け、段は h3 にする
      ...HANDBOOK_PARTS.map(
        (p) =>
          `<section id="${p.id}"><h2>${esc(p.title)}</h2><p>${esc(p.lead)}</p>${p.domains
            .map((d) => `<h3>${esc(sectionName(d.domain))}</h3><ul>${d.topics.map((t) => `<li>${link(`handbook/${t.id}/`, t.title)}: ${esc(t.summary)}</li>`).join('')}</ul>`)
            .join('')}</section>`,
      ),
    ].join('\n'),
  });
  for (const t of HANDBOOK_TOPICS) {
    const step = (s) => `<li><p>${esc(s.text)}</p>${s.code ? `<pre><code>${esc(s.code.text)}</code></pre>` : ''}${s.output ? `<pre>${esc(s.output)}</pre>` : ''}</li>`;
    pages.push({
      path: `handbook/${t.id}/`,
      title: t.title,
      description: clip(t.summary),
      body: [
        `<p>${link('handbook/', 'ハンドブック')} / ${esc(sectionName(t.domain))}</p>`,
        `<h1>${esc(t.title)}</h1>`,
        `<p>${esc(t.summary)}</p>`,
        '<h2>全体の流れ</h2>',
        `<ol>${t.flow.map(step).join('')}</ol>`,
        '<h2>試したいなら</h2>',
        ...t.try.map((x) => `<h3>${esc(x.goal)}</h3><ol>${x.steps.map(step).join('')}</ol>`),
        '<h2>出典 (公式のドキュメント)</h2>',
        `<ul>${t.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')}</ul>`,
      ].join('\n'),
    });
  }

  // 用語集: 一覧を検索に載せ、1 語ずつのページは一覧を正にする (中身が短いため)
  const terms = glossary.terms;
  pages.push({
    path: 'glossary/',
    title: '用語集',
    description: `KCNA-JP の問題に出る Kubernetes とクラウドネイティブの用語 ${terms.length} 語の短い説明と、公式の文書の出典。`,
    body: ['<h1>用語集</h1>', `<dl>${terms.map((t) => `<dt id="${esc(t.id)}">${esc(t.term)}${t.aliases?.length ? ` (${esc(t.aliases.join('・'))})` : ''}</dt><dd>${esc(t.description)} <a href="${esc(t.source)}">出典</a></dd>`).join('')}</dl>`].join('\n'),
  });
  for (const t of terms) {
    pages.push({ path: `glossary/${t.id}/`, canonical: 'glossary/', inSitemap: false, title: `${t.term} (用語集)`, description: clip(t.description), body: `<h1>${esc(t.term)}</h1>\n<p>${esc(t.description)}</p>\n<p>${link('glossary/', '用語集の一覧')}</p>` });
  }

  // 似た語の比較表: 一覧と、表ごとのページ (表・取り違えやすい点・コード・出典まで、画面と同じ中身)
  const tables = (await load('/src/content/compare.json')).default;
  pages.push({
    path: 'compare/',
    title: '似た語の比較表',
    description: `Deployment と StatefulSet、ConfigMap と Secret など、KCNA で取り違えやすい Kubernetes の語の違いを ${tables.length} の表にまとめ、公式の文書で確かめた出典を付けた。`,
    body: ['<h1>似た語の比較表</h1>', `<ul>${tables.map((t) => `<li>${link(`compare/${t.id}/`, t.title)}: ${esc(t.lead)}</li>`).join('')}</ul>`].join('\n'),
  });
  for (const t of tables) {
    pages.push({
      path: `compare/${t.id}/`,
      title: t.title,
      description: clip(t.lead),
      body: [
        `<p>${link('compare/', '似た語の比較表')}</p>`,
        `<h1>${esc(t.title)}</h1>`,
        `<p>${esc(t.lead)}</p>`,
        `<table><thead><tr><th scope="col">観点</th>${t.columns.map((c) => `<th scope="col">${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
        '<h2>取り違えやすい点</h2>',
        `<ul>${t.pitfalls.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`,
        '<h2>違いが見えるコード</h2>',
        ...t.example.map((e) => `<h3>${esc(e.title)}</h3><pre><code>${esc(e.code)}</code></pre>`),
        '<h2>出典</h2>',
        `<ul>${t.sources.map((x) => `<li><a href="${esc(x.url)}">${esc(x.label)}</a></li>`).join('')}</ul>`,
      ].join('\n'),
    });
  }

  // 週とレッスン (問題文までを書き、答えと解説は書かない。画面でも答えるまで出ないため)
  for (const w of WEEKS) {
    const ls = lessonsOf(w);
    pages.push({
      path: `week/${w.week}/`,
      title: `第 ${w.week} 週 ${w.title}`,
      description: clip(`第 ${w.week} 週 ${w.title} (${w.domain}・${w.area})。この週で説明できるようにすること: ${w.goals.join('・')}`),
      body: [`<h1>第 ${w.week} 週 ${esc(w.title)}</h1>`, `<p>${esc(w.domain)} · ${esc(w.area)}</p>`, '<h2>この週で説明できるようにすること</h2>', `<ol>${w.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ol>`, '<h2>レッスン</h2>', `<ul>${ls.map((l) => `<li>${link(`lesson/${l.id}/`, l.title)} (${esc(l.summary)})</li>`).join('')}</ul>`].join('\n'),
    });
    for (const l of ls) {
      const qs = l.kind === 'quiz' ? l.questions : [];
      pages.push({
        path: `lesson/${l.id}/`,
        title: `${l.title} (第 ${w.week} 週)`,
        description: clip(`第 ${w.week} 週 ${w.title} のレッスン「${l.title}」。${l.summary}。${qs[0]?.prompt ?? ''}`),
        body: [`<p>${link(`week/${w.week}/`, `第 ${w.week} 週 ${w.title}`)}</p>`, `<h1>${esc(l.title)}</h1>`, `<p>${esc(l.summary)}</p>`, qs.length ? `<ol>${qs.map((q) => `<li>${esc(q.prompt)}</li>`).join('')}</ol>` : ''].join('\n'),
      });
    }
  }

  // 一人ひとりの記録を見る画面は、直接開けるようにだけして、検索には載せない
  for (const [p, title] of [['review/', '復習'], ['progress/', '進捗'], ['settings/', '設定'], ['exam/', '模擬試験'], ['about/', 'このサイトについて']]) {
    const personal = p !== 'about/' && p !== 'exam/';
    pages.push({ path: p, title, description: `クラネイの${title}の画面。`, body: `<h1>${esc(title)}</h1>`, noindex: personal, inSitemap: !personal });
  }
  // 題名は画面と同じ関数で決める (サイトの中で移ったときの document.title と食い違わないように)
  for (const page of pages) page.title = titleOf(page.path) ?? page.title;
  // 第 1 週はトップと同じ画面なので、トップを正にして sitemap から外す
  const week1 = pages.find((x) => x.path === 'week/1/');
  if (week1) Object.assign(week1, { canonical: '', inSitemap: false });
  return pages;
}

/** lastmod は付けない (作るたびの日付では正しくなく、Google はいつも正しいときだけ使うため) */
export function sitemap(pages) {
  const urls = [{ path: '' }, ...pages.filter((p) => p.inSitemap !== false && !p.noindex)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${url(p.path)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
  try {
    const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
    const pages = await buildPages((m) => server.ssrLoadModule(m));
    for (const page of pages) {
      const dir = path.join(DIST, page.path);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'index.html'), renderPage(template, page));
    }
    // 知らない URL は GitHub Pages が 404.html を返す。画面は JS で「見つからない」かトップを出す
    await writeFile(path.join(DIST, '404.html'), renderPage(template, { path: '', title: 'ページが見つかりません', description: 'クラネイ — KCNA-JP 対策', body: '<h1>ページが見つかりません</h1>', noindex: true }));
    await writeFile(path.join(DIST, 'sitemap.xml'), sitemap(pages));
    // robots.txt はドメインの直下 (maco165.github.io リポジトリ) にしか置けないので、そこの Sitemap の行からこの sitemap を指す
    console.log(`prerender: ${pages.length} ページ・sitemap ${sitemap(pages).split('<url>').length - 1} 件`);
  } finally {
    await server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) await main();
