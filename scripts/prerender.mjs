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

const SITE_NAME = 'クラネイ';
const SITE_TITLE = 'クラネイ — KCNA-JP 対策';

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
  jsonLd: /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/,
};

const SITE_ID = `${ORIGIN}${BASE}#website`;
/** JSON-LD を script の中に書ける形にする (</script> などで閉じられないよう < を \u003c にする) */
const ldJson = (v) => JSON.stringify(v, null, 2).replace(/</g, '\\u003c');

/** dist/index.html を型にして、1 ページ分の HTML を作る。置き換えは関数で渡す ($1 などを置き換えの記号として読ませない) */
export function renderPage(template, { path: p, title, fullTitle, description, body, noindex = false, canonical, jsonLd }) {
  // fullTitle は buildPages が画面と同じ関数 (src/lib/pageTitle.ts の withSite) で決める。無ければ同じ形で作る
  const full = fullTitle ?? (title ? `${title} | ${SITE_NAME}` : SITE_TITLE);
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
    // WebSite はトップだけが持つ。ほかのページはそのページの構造化データ (無ければ書かない)
    jsonLd: (m) => (p === '' && !noindex ? m : jsonLd ? `\n    <script type="application/ld+json">\n${ldJson({ '@context': 'https://schema.org', '@graph': jsonLd })}\n    </script>` : ''),
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
  const { withSite } = await load('/src/lib/pageTitle.ts');
  const { parseRoute } = await load('/src/lib/route.ts');
  const titleOf = (p) => pageTitle(parseRoute(`${BASE}${p}`));
  const { WEEKS } = await load('/src/content/curriculum.ts');
  const { HANDBOOK_PARTS, HANDBOOK_TOPICS, isAppendixDomain, sectionName: shortName } = await load('/src/content/handbook.ts');
  const sectionName = (d) => (isAppendixDomain(d) ? `${shortName(d)} (資格の範囲の外)` : d);
  const { CURRICULUM, DEFINITION } = await load('/src/content/guide.ts');
  const glossary = (await load('/src/content/glossary.json')).default;
  const pages = [];
  // レッスンの本文は問題の全文 (lessons.ts) から書く (curriculum.ts の WEEKS は問題を id・形・問題文だけにした軽い形)
  const { WEEK_CONTENTS, questionBank } = await load('/src/content/lessons.ts');
  const fullOf = new Map(WEEK_CONTENTS.map((c) => [c.week, c.lessons]));
  const lessonsOf = (w) => fullOf.get(w.week) ?? [];
  // ページどうしのつながり。画面 (ハンドブック・コマンド・用語集) が出すのと同じデータから、JS なしの HTML にもリンクを書く
  const { findLesson: findLessonMeta } = await load('/src/content/index.ts');
  const { commandUses } = await load('/src/lib/commandRefs.ts');
  const commandData = (await load('/src/content/commands.json')).default;
  const lessonLinks = (ids) => {
    const found = [...new Set(ids)].map((id) => [id, findLessonMeta(id)]).filter(([, f]) => f);
    return found.length ? `<ul>${found.map(([id, f]) => `<li>${link(`lesson/${id}/`, `第 ${f.week} 週 ${f.lesson.title}`)}</li>`).join('')}</ul>` : '';
  };
  /** コマンドの id → それが出てくるレッスンの id (出てくる順)。画面のコマンドのページと同じく commandUses で数える */
  const lessonsOfCommand = new Map();
  for (const c of WEEK_CONTENTS) for (const l of c.lessons) for (const q of l.kind === 'quiz' ? l.questions : []) for (const u of commandUses(q, commandData)) {
    const ids = lessonsOfCommand.get(u.entry.id) ?? [];
    if (!ids.includes(l.id)) ids.push(l.id);
    lessonsOfCommand.set(u.entry.id, ids);
  }
  /** 解説の記事 (ハンドブックのトピック・コマンド・比較表)。出典を citation にする */
  const article = (headline, sources) => ({ '@type': 'TechArticle', headline, citation: [...new Map(sources.map((s) => [s.url, s])).values()].map((s) => ({ '@type': 'CreativeWork', name: s.label, url: s.url })) });

  // 説明のページ
  pages.push({
    path: 'guide/',
    title: 'Kubernetes とこのサイト',
    description: 'KCNA-JP の試験の目的と形式、出題範囲 (学習要領の 4 分野と細目)、このサイトの問題の作り方と出典をまとめたページ。',
    body: [
      '<h1>Kubernetes とこのサイト</h1>',
      `<p>${esc(DEFINITION)}</p>`,
      '<h2>学び方</h2>',
      '<p>レッスンは問題から始まります。Kubernetes が初めての人は、週の一覧の「先に読む」からハンドブックのトピックを読んでから解きます。触ったことがある人は解いてから、答えたあとの「読み直す」で戻ります。</p>',
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
      heading: t.title,
      description: clip(t.summary),
      entity: article(t.title, t.sources),
      body: [
        `<h1>${esc(t.title)}</h1>`,
        `<p>${esc(sectionName(t.domain))}</p>`,
        `<p>${esc(t.summary)}</p>`,
        '<h2>全体の流れ</h2>',
        `<ol>${t.flow.map(step).join('')}</ol>`,
        '<h2>試したいなら</h2>',
        ...t.try.map((x) => `<h3>${esc(x.goal)}</h3><ol>${x.steps.map(step).join('')}</ol>`),
        t.lessons.length && lessonLinks(t.lessons) ? `<h2>問題で練習する</h2>${lessonLinks(t.lessons)}` : '',
        '<h2>出典 (公式のドキュメント)</h2>',
        `<ul>${t.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')}</ul>`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  // 用語集: 一覧を検索に載せ、1 語ずつのページは一覧を正にする (中身が短いため)
  const terms = glossary.terms;
  const { sortTerms, termDomain } = await load('/src/lib/glossary.ts');
  const { findLesson } = await load('/src/content/index.ts');
  const { DOMAINS } = await load('/src/lib/lessonStatus.ts');
  const ORDER = DOMAINS.map((d) => d.name);
  const sorted = sortTerms(terms).map((t) => ({ ...t, domain: termDomain(t, (id) => findLesson(id)?.lesson.domain, ORDER) }));
  // 語の出てくるレッスン (画面の「出てくるレッスン」と同じ)
  const termLessons = (t) => {
    const found = (t.lessons ?? []).map((id) => [id, findLesson(id)]).filter(([, f]) => f);
    return found.length ? ` 出てくるレッスン: ${found.map(([id, f]) => link(`lesson/${id}/`, `第 ${f.week} 週 ${f.lesson.title}`)).join('、')}` : '';
  };
  const termGroups = [...ORDER.map((d) => ({ d, items: sorted.filter((t) => t.domain === d) })), { d: '範囲外', items: sorted.filter((t) => !t.domain) }].filter((g) => g.items.length > 0);
  pages.push({
    path: 'glossary/',
    title: '用語集',
    description: `KCNA-JP の問題に出る Kubernetes とクラウドネイティブの用語 ${terms.length} 語の短い説明と、公式の文書の出典。`,
    entity: {
      '@type': 'DefinedTermSet',
      name: 'クラネイの用語集',
      hasDefinedTerm: terms.map((t) => ({ '@type': 'DefinedTerm', name: t.term, ...(t.aliases?.length ? { alternateName: t.aliases } : {}), description: t.description, url: url(`glossary/#${t.id}`) })),
    },
    body: [
      '<h1>用語集</h1>',
      // 画面の一覧と同じく、語の出てくるレッスンの分野ごとに分け (h2)、どのレッスンにも出ない語は「範囲外」にまとめる
      ...termGroups.map((g) => `<section><h2>${esc(g.d)} (${g.items.length} 語)</h2><dl>${g.items.map((t) => `<dt id="${esc(t.id)}">${esc(t.term)}${t.aliases?.length ? ` (${esc(t.aliases.join('・'))})` : ''}</dt><dd>${esc(t.description)} <a href="${esc(t.source)}">出典</a>${termLessons(t)}</dd>`).join('')}</dl></section>`),
    ].join('\n'),
  });
  for (const t of terms) {
    pages.push({ path: `glossary/${t.id}/`, canonical: 'glossary/', inSitemap: false, title: `${t.term} (用語集)`, description: clip(t.description), body: `<h1>${esc(t.term)}</h1>\n<p>${esc(t.description)}</p>\n<p>${link('glossary/', '用語集の一覧')}</p>` });
  }

  // コマンド: 一覧と、コマンドごとのページ (中で何が起きるか・API の要求・実行の例・実装の抜粋まで、画面と同じ中身)
  const { COMMAND_PAGES, TOOL_ORDER, implUrl, commandPageTitle } = await load('/src/content/commandPages.ts');
  pages.push({
    path: 'commands/',
    title: 'コマンド',
    description: `kubectl・helm など、KCNA の問題に出てくる ${COMMAND_PAGES.length} のコマンドが中で何をしているか (API の要求・動く部品) を、実行の例と実装のソースと一緒に、公式リファレンスに沿って説明する。`,
    // 画面の一覧と同じく、道具ごとに分ける (h2)
    body: ['<h1>コマンド</h1>', ...TOOL_ORDER.map((tool) => ({ tool, cs: COMMAND_PAGES.filter((c) => c.tool === tool) })).filter((g) => g.cs.length > 0).map((g) => `<section><h2>${esc(g.tool)}</h2><ul>${g.cs.map((c) => `<li>${link(`commands/${c.id}/`, c.command)}: ${esc(c.summary)}</li>`).join('')}</ul></section>`)].join('\n'),
  });
  for (const c of COMMAND_PAGES) {
    const flags = [...(c.flags ?? []), ...c.globalFlags];
    pages.push({
      path: `commands/${c.id}/`,
      title: commandPageTitle(c.id),
      heading: c.command,
      description: clip(`${c.summary} ${c.detail ?? ''}`),
      entity: article(c.command, [{ label: `${c.command} の公式リファレンス`, url: c.source }, ...c.sources]),
      body: [
        `<h1>${esc(c.command)}</h1>`,
        `<p>${esc(c.summary)}</p>`,
        c.detail ? `<p>${esc(c.detail)}</p>` : '',
        '<h2>書き方</h2>',
        `<pre><code>${esc(c.usage)}</code></pre>`,
        flags.length ? `<dl>${flags.map((f) => `<dt>${esc(f.flags.join(', '))}</dt><dd>${esc(f.text)}</dd>`).join('')}</dl>` : '',
        '<h2>中で何が起きるか</h2>',
        `<ol>${c.inside.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`,
        c.api.length ? `<table><thead><tr><th>メソッド</th><th>パス</th><th>いつ</th></tr></thead><tbody>${c.api.map((a) => `<tr><td>${esc(a.method)}</td><td>${esc(a.path)}</td><td>${esc(a.note ?? '')}</td></tr>`).join('')}</tbody></table>` : '',
        '<h2>実行の例</h2>',
        ...c.examples.map((e) => `<h3>${esc(e.title)}</h3><pre><code>${esc(e.output ? `${e.code}\n${e.output}` : e.code)}</code></pre>${e.note ? `<p>${esc(e.note)}</p>` : ''}`),
        c.verbose ? `<h3>-v で見える要求</h3><pre><code>${esc(`${c.verbose.code}\n${c.verbose.output}`)}</code></pre>` : '',
        c.impl ? `<h2>実装を読む</h2><p><a href="${esc(implUrl(c.impl))}">${esc(`${c.impl.repo} ${c.impl.ref} の ${c.impl.path}`)}</a></p><pre><code>${esc(c.impl.excerpt)}</code></pre>` : '',
        lessonsOfCommand.has(c.id) ? `<h2>出てくるレッスン</h2>${lessonLinks(lessonsOfCommand.get(c.id))}` : '',
        '<h2>出典</h2>',
        `<ul>${[{ label: `${c.command} の公式リファレンス`, url: c.source }, ...c.sources.filter((x) => x.url !== c.source)].map((x) => `<li><a href="${esc(x.url)}">${esc(x.label)}</a></li>`).join('')}</ul>`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  // 似た語の比較表: 一覧と、表ごとのページ (表・取り違えやすい点・コード・出典まで、画面と同じ中身)
  const tables = (await load('/src/content/compare.json')).default;
  const { COMPARE_LEAD } = await load('/src/content/compare.ts');
  pages.push({
    path: 'compare/',
    title: '似た語の比較表',
    description: `Deployment と StatefulSet、ConfigMap と Secret など、KCNA で取り違えやすい Kubernetes の語の違いを ${tables.length} の表にまとめ、公式の文書で確かめた出典を付けた。`,
    body: [
      '<h1>似た語の比較表</h1>',
      `<p>${esc(COMPARE_LEAD)}</p>`,
      `<p>1 語ずつの説明は ${link('glossary/', '用語集')}、仕組みの流れは ${link('handbook/', 'ハンドブック')} にあります。</p>`,
      `<h2>表の一覧 (${tables.length})</h2>`,
      `<ul>${tables.map((t) => `<li>${link(`compare/${t.id}/`, t.title)} (${esc(t.columns.map((c) => c.name).join(' · '))}): ${esc(t.lead)}</li>`).join('')}</ul>`,
    ].join('\n'),
  });
  for (const t of tables) {
    pages.push({
      path: `compare/${t.id}/`,
      title: t.short ?? t.title,
      heading: t.title,
      description: clip(t.lead),
      entity: article(t.title, t.sources),
      body: [
        `<h1>${esc(t.title)}</h1>`,
        `<p>${esc(t.lead)}</p>`,
        `<table><thead><tr><th scope="col">観点</th>${t.columns.map((c) => `<th scope="col">${c.term ? link(`glossary/#${c.term}`, c.name) : esc(c.name)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
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
  // 問題は画面で答える前に見えるもの (問題文・コード・選択肢・候補) だけを書く。空欄は ＿＿＿ にする。
  // 選択肢と候補はデータの並びでは正解が前に寄るので (画面は出すたびに混ぜる)、問題の id から決まる順に混ぜて正解の位置を見せない
  // (書き出すたびに同じ順。文字の順は正解の位置が偏るので使わない。偏りは tests/pages.test.ts が見る)
  const questionHtml = (q) =>
    q.type === 'choice'
      ? `<li><p>${esc(q.prompt)}</p>${q.code ? `<pre><code>${esc(q.code.text)}</code></pre>` : ''}<ul class="q-choices">${(q.fixedOrder ? q.choices.map((c) => c.text) : mixById(q.choices.map((c) => c.text), q.id)).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></li>`
      : `<li><p>${esc(q.prompt)}</p><pre><code>${esc(q.code.replace('{{blank}}', '＿＿＿'))}</code></pre>${q.candidates?.length ? `<p>候補</p><ul class="q-candidates">${mixById(q.candidates, q.id).map((t) => `<li><code>${esc(t)}</code></li>`).join('')}</ul>` : ''}</li>`;
  const quizShape = (qs) => {
    const choice = qs.filter((q) => q.type === 'choice').length;
    const parts = [choice ? `4 択 ${choice} 問` : '', qs.length - choice ? `穴埋め ${qs.length - choice} 問` : ''].filter(Boolean);
    return parts.length > 1 ? `${parts.join('・')}の全 ${qs.length} 問` : parts[0];
  };
  // 週のページのレッスンごとの項目。何を問うかが分かるよう、答える前に見える問題文を先頭から数問 (実習は目的) だけ書く。答え・選択肢は書かない
  const weekLessonHtml = (l) =>
    `<h3>${link(`lesson/${l.id}/`, l.title)}</h3><p>${esc(l.summary)}</p>` +
    (l.kind === 'lab'
      ? `<p>${esc(l.goal)}</p>`
      : `<p>問うことの例:</p><ul>${l.questions.slice(0, WEEK_PROMPTS).map((q) => `<li>${esc(q.prompt)}</li>`).join('')}</ul>`);
  // レッスン → 出てくる用語とコマンド (用語集とコマンドのページから見たつながりの逆向き)
  const commandPageIds = new Set(COMMAND_PAGES.map((c) => c.id));
  const relatedOfLesson = (l) => {
    const ts = glossary.terms.filter((t) => t.lessons?.includes(l.id));
    const cs = COMMAND_PAGES.filter((c) => commandPageIds.has(c.id) && lessonsOfCommand.get(c.id)?.includes(l.id));
    return [
      ts.length ? `<h2>出てくる用語</h2><ul>${ts.map((t) => `<li>${link(`glossary/#${t.id}`, t.term)}</li>`).join('')}</ul>` : '',
      cs.length ? `<h2>出てくるコマンド</h2><ul>${cs.map((c) => `<li>${link(`commands/${c.id}/`, c.command)}</li>`).join('')}</ul>` : '',
    ].join('');
  };
  for (const w of WEEKS) {
    const ls = lessonsOf(w);
    pages.push({
      path: `week/${w.week}/`,
      title: `第 ${w.week} 週 ${w.title}`,
      description: clip(`第 ${w.week} 週 ${w.title} (${w.domain}・${w.area})。この週で説明できるようにすること: ${w.goals.join('・')}`),
      body: [`<h1>第 ${w.week} 週 ${esc(w.title)}</h1>`, `<p>${esc(w.domain)} · ${esc(w.area)}</p>`, '<h2>この週で説明できるようにすること</h2>', `<ol>${w.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ol>`, '<h2>先に読む</h2>', `<ul>${w.read.map((r) => `<li>${link(`handbook/${r.topic}/`, r.label)}</li>`).join('')}</ul>`, '<h2>レッスン</h2>', ls.map(weekLessonHtml).join('\n')].join('\n'),
    });
    for (const l of ls) {
      const qs = l.kind === 'quiz' ? l.questions : [];
      pages.push({
        path: `lesson/${l.id}/`,
        title: l.title,
        parent: w.week === 1 ? '' : `week/${w.week}/`,
        entity: { '@type': 'LearningResource', name: l.title, learningResourceType: l.kind === 'lab' ? '実習' : '練習問題', isAccessibleForFree: true },
        description: clip(`第 ${w.week} 週 ${w.title} のレッスン「${l.title}」。${l.summary}。${qs[0]?.prompt ?? ''}`),
        body: [
          `<h1>${esc(l.title)}</h1>`,
          `<p>${esc(l.summary)}</p>`,
          `<p>第 ${w.week} 週「${esc(w.title)}」(${esc(w.domain)} · ${esc(w.area)}) の${l.kind === 'lab' ? '実習です。家のクラスタ (k3s) で手順を順に打ち、全部の手順を確かめたら完了にします' : `レッスンです。${quizShape(qs)}を順に解きます。1 問解くごとに、解説と公式の文書の出典が出ます`}。</p>`,
          l.kind === 'lab'
            ? `<h2>この実習で分かること</h2><p>${esc(l.goal)}</p><h2>用意するもの</h2><ul>${l.needs.map((n) => `<li>${esc(n)}</li>`).join('')}</ul><h2>手順</h2><ol>${l.steps.map((s) => `<li><p>${esc(s.text)}</p>${s.command ? `<pre><code>${esc(s.command)}</code></pre>` : ''}</li>`).join('')}</ol>`
            : `<h2>問題</h2><ol>${qs.map(questionHtml).join('')}</ol>`,
          relatedOfLesson(l),
          w.read.length ? `<h2>先に読む</h2><ul>${w.read.map((r) => `<li>${link(`handbook/${r.topic}/`, r.label)}</li>`).join('')}</ul>` : '',
        ].join('\n'),
      });
    }
  }

  // 一人ひとりの記録を見る画面は、直接開けるようにだけして、検索には載せない
  for (const [p, title] of [['review/', '復習'], ['progress/', '進捗'], ['settings/', '設定']]) {
    pages.push({ path: p, title, description: `クラネイの${title}の画面。`, body: `<h1>${esc(title)}</h1>`, noindex: true, inSitemap: false });
  }

  // 模擬試験: 始める前の画面と同じ説明 (形式・分野ごとの問題の数・回) と、本番の試験の形式・出題範囲
  const exam = await load('/src/lib/exam.ts');
  const { EXAM_FACTS } = await load('/src/content/guide.ts');
  const examSets = (await load('/src/content/examSets.json')).default.sets;
  const fresh = examSets.filter((s) => s.questions.every((id) => id.startsWith('x-'))).map((s) => s.id);
  const counts = exam.domainCounts();
  pages.push({
    path: 'exam/',
    title: '模擬試験',
    description: `KCNA-JP の模擬試験。本番と同じ 4 分野の配点で ${exam.EXAM_QUESTIONS} 問・${exam.EXAM_MINUTES} 分。問題の決まった第 1〜${examSets.length} 回とランダムがあり、最後にまとめて採点して分野ごとの正答率を出す。`,
    body: [
      '<h1>模擬試験</h1>',
      `<p>${esc(exam.examIntro(examSets.length, fresh, questionBank().length))}</p>`,
      '<h2>出る問題の数</h2>',
      `<ul>${Object.entries(exam.EXAM_WEIGHTS).map(([d, w]) => `<li>${esc(d)}: 配点 ${w}% · ${counts[d]} 問</li>`).join('')}</ul>`,
      `<p>${esc(exam.PASS_NOTE)}</p>`,
      '<h2>回の選び方</h2>',
      `<ul>${examSets.map((s) => `<li>第 ${s.id} 回: ${s.questions.length} 問 (${fresh.includes(s.id) ? 'レッスンに無い初見の問題' : '第 1〜8 週のレッスンの問題'})</li>`).join('')}<li>ランダム: 毎回、第 1〜8 週の問題から選び直します</li></ul>`,
      '<h2>本番の試験の形式</h2>',
      `<dl>${EXAM_FACTS.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}${f.note ? ` (${esc(f.note)})` : ''} ${f.sources.map((s) => `<a href="${esc(s.url)}">${esc(s.label)}</a>`).join('・')}</dd>`).join('')}</dl>`,
      `<p>出題範囲 (学習要領の 4 分野と細目) は ${link('guide/', 'Kubernetes とこのサイト')} に、分野ごとの説明は ${link('handbook/', 'ハンドブック')} にあります。</p>`,
    ].join('\n'),
  });

  // このサイトについて: 画面と同じ文 (src/content/about.ts) と、非公式であること・出典の考え方・ライセンス
  const { ABOUT } = await load('/src/content/about.ts');
  const { REPO_URL, NEW_ISSUE_URL } = await load('/src/lib/links.ts');
  const { SOURCES } = await load('/src/content/guide.ts');
  pages.push({
    path: 'about/',
    title: 'このサイトについて',
    description: 'クラネイは KCNA-JP 対策の、個人が作った非公式の学習サイト。The Linux Foundation・CNCF とは関係がない。問題は公式の文書で確かめて出典を付け、コードと問題のデータは GitHub で MIT ライセンスで公開している。',
    body: [
      '<h1>このサイトについて</h1>',
      `<p>${esc(ABOUT.intro)}</p>`,
      `<p>${esc(ABOUT.notice)}</p>`,
      '<h2>ソースコード</h2>',
      `<p>${esc(ABOUT.source)} <a href="${esc(REPO_URL)}" target="_blank" rel="noopener noreferrer">GitHub のリポジトリ (github.com/maco165/kcna-dojo)</a></p>`,
      '<h2>問題の誤りを見つけたら</h2>',
      `<p>${esc(ABOUT.issue)} <a href="${esc(NEW_ISSUE_URL)}">Issue を書く</a></p>`,
      '<h2>知っておくこと</h2>',
      `<dl><dt>記録の置き場所</dt><dd>${esc(ABOUT.storage)}</dd><dt>AI に聞く</dt><dd>${esc(ABOUT.askAi)}</dd><dt>問題について</dt><dd>${esc(ABOUT.questions)}作り方と出典の内訳は ${link('guide/', 'Kubernetes とこのサイト')} に。</dd><dt>ライセンス</dt><dd>MIT (<a href="${esc(REPO_URL)}/blob/main/LICENSE">LICENSE</a>)</dd></dl>`,
      '<h2>試験と Kubernetes の説明の出典</h2>',
      `<ul>${Object.values(SOURCES).map((s) => `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')}</ul>`,
    ].join('\n'),
  });
  // 題名は画面と同じ関数で決める (サイトの中で移ったときの document.title と食い違わないように)
  for (const page of pages) {
    page.title = titleOf(page.path) ?? page.title;
    page.fullTitle = withSite(page.title);
  }
  // 第 1 週はトップと同じ画面なので、トップを正にして sitemap から外す
  const week1 = pages.find((x) => x.path === 'week/1/');
  if (week1) Object.assign(week1, { canonical: '', inSitemap: false });
  // 検索に載るページに、見えるパンくずと構造化データ (BreadcrumbList と、ページの種類ごとの型) を付ける。2 つは同じ階層 (crumbsOf)
  const byPath = new Map(pages.map((x) => [x.path, x]));
  for (const page of pages) {
    if (!isIndexed(page)) continue;
    // パンくずの名前は見出し (h1) と同じ名前にする (題名の short は使わない。画面のパンくず・TechArticle の headline とそろえる)
    const crumbs = crumbsOf(page.path, page.parent).map((p) => ({ path: p, name: p === '' ? SITE_NAME : (byPath.get(p).heading ?? byPath.get(p).title) }));
    const last = crumbs.length - 1;
    const nav = `<nav aria-label="パンくず" class="hb-crumbs"><ol>${crumbs.map((c, i) => (i === last ? `<li aria-current="page">${esc(c.name)}</li>` : `<li>${link(c.path, c.name)}</li>`)).join('')}</ol></nav>`;
    page.body = `${nav}\n${page.body}`;
    const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: url(c.path) })) };
    const main = page.entity ? { ...page.entity, url: url(page.path), description: page.description, inLanguage: 'ja', isPartOf: { '@id': SITE_ID } } : null;
    page.jsonLd = main ? [main, breadcrumb] : [breadcrumb];
  }
  return pages;
}

/**
 * 並びを key (問題の id) から決まる順に混ぜる。同じ key なら毎回同じ順 (書き出すたびに HTML が変わらない)。
 * key の FNV-1a のハッシュを種にした mulberry32 で Fisher–Yates
 */
export function mixById(xs, key) {
  let h = 0x811c9dc5;
  for (const ch of String(key)) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193);
  let s = h >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 検索に載るページか (noindex でなく、canonical を別のページに向けていない) */
export const isIndexed = (page) => !page.noindex && (page.canonical === undefined || page.canonical === page.path);

/**
 * パンくずの階層 (トップから自分まで)。一覧の下のページは一覧を親にし、レッスンは週 (parent) を親にする。
 * 第 1 週はトップと同じ画面なので、第 1 週のレッスンの parent はトップにする
 */
export function crumbsOf(p, parent) {
  if (p === '') return [''];
  const list = p.match(/^(handbook|commands|compare|glossary)\/[^/]+\/$/);
  const up = parent ?? (list ? `${list[1]}/` : '');
  return up === '' ? ['', p] : ['', up, p];
}

/** 週のページに、レッスンごとに書く問題文の数 */
const WEEK_PROMPTS = 2;

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
