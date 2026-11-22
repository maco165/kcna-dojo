#!/usr/bin/env node
// ブラウザでの通しの検査。npm run e2e で、組み立てた dist を vite preview で配り、Playwright の Chromium で操作する。
// スマホ (390 幅) と PC (1280 幅) のそれぞれで、空の localStorage から次を確かめる:
//   1. ホームで最初のレッスンだけが「開始」になっている。今日の目標は 0 XP
//   2. 4 択のレッスンを、1 問目は不正解、残りは正解で解き、解説と完了画面の正答数が出る
//   3. ホームへ戻ると 1 つ目が完了、2 つ目が「開始」になり、今日の目標の XP が増えている
//   4. コマンドの穴埋めに打ち込んで Enter で確かめると、正解と実行結果の例が出る。候補を押して不正解なら、なぜ違うかが出る
//   5. 「もう一度解く」で 1 問目から数え直す
//   6. 実習は全部の手順に印を付けると完了にできる
//   7. AI に聞くリンクに問題文が入っている (答える前は正解を入れない)
//   8. どの画面も横にはみ出さない
//   9. リポジトリへのリンク、このサイトについての画面、サイト名の横の印
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = Number(process.env.E2E_PORT ?? 4318);
const BASE = `http://localhost:${PORT}/kcna-dojo/`;
const week1 = JSON.parse(readFileSync(new URL('../src/content/week1.json', import.meta.url), 'utf8'));
const l1 = week1.lessons[0];
const l2 = week1.lessons[1];
const l3 = week1.lessons[2];
const lab = week1.lessons.find((l) => l.kind === 'lab');

let failures = 0;
function check(cond, label) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}`);
  if (!cond) failures++;
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    if (serverExited) throw new Error(`vite preview が ${PORT} 番で立ちませんでした (番号が埋まっていないか確かめる)`);
    try {
      const res = await fetch(BASE);
      // 残っている別のサーバー (古い build) ではなく、いま組み立てた dist を配っていることを確かめる
      if (res.ok) {
        if ((await res.text()) === readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')) return;
        throw new Error(`${BASE} が今の dist と違う中身を返します (古い vite preview が残っていないか確かめる)`);
      }
    } catch {
      // 立ち上がるまで待つ
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`vite preview が ${BASE} で応えません`);
}

async function noHorizontalOverflow(page, width, label) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= width, `${label}: 横にはみ出さない (scrollWidth ${sw} <= ${width})`);
}

// 選択肢は出すたびに混ぜるので、記号ではなく文で選ぶ
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const choiceLabel = (q, choiceId) => {
  const text = q.choices.find((c) => c.id === choiceId).text;
  return new RegExp(`^[A-D]\\. ${escapeRe(text)}$`);
};

/**
 * 軽さの見張り: トップの HTML が最初に読む JS (script と modulepreload) の gzip の合計を測る。
 * ハンドブックと用語集のデータは開いたときに読むので、最初には入らないこと
 */
function checkFirstLoad() {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const files = [...new Set([...html.matchAll(/\/kcna-dojo\/assets\/([^"]+\.js)/g)].map((m) => m[1]))];
  const gz = files.reduce((n, f) => n + gzipSync(readFileSync(new URL(`../dist/assets/${f}`, import.meta.url)), { level: 9 }).length, 0);
  const kb = Math.round(gz / 1024);
  // 2026-11-22 に週の問題の全文とレッスンの画面を開いたときに読むようにして 326KB → 240KB (gzip -9 で測った値)。ゆとりを 10KB だけ見る
  check(kb <= 250, `最初に読む JS は gzip で 250KB まで (${kb}KB、${files.length} ファイル)`);
  // 名前だけでなく中身でも見る (静的に取り込まれて本体に混ざっても気づけるように)。それぞれのデータにしか無い文字で調べる
  const marks = { ハンドブックのデータ: 'k3s-vs-kubernetes', 用語集のデータ: 'container-image', 説明のページ: '2026-03-22 の版', 模擬試験用の問題: 'のイメージを更新した直後に', 比較表のデータ: 'volumeClaimTemplates:  # Pod ごとに', コマンドの説明: 'リソースの一覧や状態を表で表示します', コマンドのページのデータ: 'Initial install underway', コマンドのページの中身: 'のような種類の名前を、API のグループ・版・資源に引き当てます', 週の問題の解説: 'VM はハイパーバイザーの上でゲスト OS ごと動きます' };
  const text = files.map((f) => readFileSync(new URL(`../dist/assets/${f}`, import.meta.url), 'utf8')).join('\n');
  const found = Object.entries(marks).filter(([, m]) => text.includes(m)).map(([k]) => k);
  check(found.length === 0, `ハンドブック・用語集・説明のページ・模擬試験用の問題・コマンドの説明・比較表・コマンドのページ・週の問題の全文は最初に読まない ${found.join(',')}`);
  // 書き出したハンドブックの目次も、画面と同じ 2 部 (h2) と段 (h3) の組みにする
  const hbHtml = readFileSync(new URL('../dist/handbook/index.html', import.meta.url), 'utf8');
  const hbHeads = [...hbHtml.matchAll(/<h([23])>([^<]*)<\/h\1>/g)].map((m) => `${m[1]}:${m[2]}`);
  check(hbHeads.filter((h) => h.startsWith('2:')).join('|') === '2:試験の範囲|2:範囲外: 一緒に知っておくと役立つこと' && hbHeads.filter((h) => h.startsWith('3:')).length === 9 && hbHtml.includes('<section id="hb-part-extra">'), `書き出したハンドブックの目次は 2 部 (h2) と 9 段 (h3) (${hbHeads.length})`);
}

/**
 * 速さの見張り (Lighthouse のスマホで遅かった所): Astryx の CSS から使わないクラスを除き (vite.config.ts の purgeStylex)、
 * 除きすぎていないこと。大きなデータは JSON.parse の形で読むこと (vite.config.ts の jsonParse)
 */
function checkSpeedBuild() {
  const assets = readdirSync(new URL('../dist/assets/', import.meta.url));
  const read = (f) => readFileSync(new URL(`../dist/assets/${f}`, import.meta.url), 'utf8');
  const cssFiles = assets.filter((f) => f.endsWith('.css'));
  const css = cssFiles.map(read).join('\n');
  const cssGz = Math.round(cssFiles.reduce((n, f) => n + gzipSync(readFileSync(new URL(`../dist/assets/${f}`, import.meta.url)), { level: 9 }).length, 0) / 1024);
  // 2026-11-23: 除く前は gzip -9 で 45KB (Astryx の CSS をそのまま入れていた)。除いたあと 37KB
  check(cssGz <= 40, `描画を止める CSS は gzip で 40KB まで (${cssGz}KB)`);
  const classes = (t) => new Set([...t.matchAll(/\.(x[a-z0-9]{4,10})(?![\w-])/g)].map((m) => m[1]));
  const all = classes(readFileSync(new URL('../node_modules/@astryxdesign/core/dist/astryx.css', import.meta.url), 'utf8'));
  const kept = classes(css);
  const js = assets.filter((f) => f.endsWith('.js')).map(read).join('\n');
  const missing = [...new Set(js.match(/\bx[a-z0-9]{4,10}\b/g))].filter((c) => all.has(c) && !kept.has(c));
  check(missing.length === 0, `JS が付ける Astryx のクラスは、CSS から除いていない (落ちたもの ${missing.length}: ${missing.slice(0, 5).join(' ')})`);
  const data = assets.filter((f) => /^(lessons|handbook|glossary|commandPages|examBank)-/.test(f));
  const literal = data.filter((f) => !/JSON\.parse\(/.test(read(f).slice(0, 400)));
  check(data.length >= 5 && literal.length === 0, `大きなデータのチャンクは JSON.parse で読む (${data.length} ファイル、そうでないもの ${literal.join(',')})`);
}

/**
 * 結果の「共有」: Web Share API があれば点数と URL だけを渡し、無ければ X の投稿 (文と URL だけ) とリンクのコピーを出す。
 * 端末の共有の画面は開けないので、navigator.share を差し替えて渡すものを見る
 */
async function checkShare(page, tag, text, url) {
  await page.evaluate(() => {
    window.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => void window.__shared.push(d) });
  });
  await page.getByRole('button', { name: '共有', exact: true }).click();
  const shared = await page.evaluate(() => window.__shared);
  check(JSON.stringify(shared) === JSON.stringify([{ text, url }]), `${tag} 共有は点数と公開の URL だけを渡す (${JSON.stringify(shared)})`);
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
  await page.getByRole('button', { name: '共有', exact: true }).click();
  const x = new URL(await page.getByRole('link', { name: 'X に投稿' }).getAttribute('href'));
  check(x.origin === 'https://x.com' && x.searchParams.get('text') === text && x.searchParams.get('url') === url && [...x.searchParams.keys()].length === 2, `${tag} Web Share API が無ければ X の投稿 (文と URL だけ) を出す`);
  check(await page.getByRole('button', { name: 'リンクをコピー' }).isVisible(), `${tag} Web Share API が無ければリンクのコピーを出す`);
}

/**
 * 学びを続ける仕組み (休みの札・週の目標・カレンダー・復習の予測・到達・.ics) を、決まった時刻と記録で見る。
 * 前の版の記録 (札・solved・run の無い形) を読ませても画面が落ちないことも見る
 */
async function checkStudyFeatures(browser, width) {
  const tag = `[学びの仕組み ${width}]`;
  const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // 2026-11-25 (水) 21:00。11/09〜11/22 に学び (札 2 個)、11/23 は休み、11/24 に学んだ。週の目標は 3 日
  await page.clock.setFixedTime(new Date(2026, 10, 25, 21, 0));
  const q1 = l1.questions[0].id;
  const day = (d) => `2026-11-${String(d).padStart(2, '0')}`;
  const byDay = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [day(9 + i), 9]));
  byDay[day(24)] = 9;
  const state = {
    v: 1,
    streak: { count: 15, lastDay: day(24), freezes: 1, toNext: 1, used: [day(23)] },
    xp: { total: 135, byDay },
    lessons: {},
    answers: { [q1]: { right: 1, wrong: 1, last: '2026-11-24T00:00:00.000Z', stage: 0, nextReview: day(26), run: 0 } },
    solved: { [day(24)]: 20 },
    profile: { dailyGoalXp: 30, weeklyDays: 3 },
  };
  await page.addInitScript((v) => localStorage.getItem('kcna.v1') || localStorage.setItem('kcna.v1', v), JSON.stringify(state));
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'コンテナの基礎' }).waitFor();
  check(await page.getByText(/休みの札 1 \/ 2 · 11\/23 に使った/).first().isVisible(), `${tag} ホームに休みの札の数と使った日が出る`);
  check(await page.getByText(/今週 1 \/ 3 日/).first().isVisible(), `${tag} ホームに今週の学んだ日 / 週の目標が出る (月曜から)`);
  await page.goto(`${BASE}progress/`);
  const cal = page.getByRole('list', { name: /過去 26 週の学んだ日/ });
  await cal.waitFor();
  const cells = await cal.getByRole('listitem').count();
  // 26 週 (月曜始まり) のうち、今日 (水) より後の 4 日は描かない
  check(cells === 26 * 7 - 4, `${tag} カレンダーは過去 26 週の今日までのマス (${cells})`);
  check((await cal.getByRole('img', { name: '11月24日(火) 20 問' }).count()) === 1 && (await cal.getByRole('img', { name: '11月10日(火) 学んだ (問題の数の記録なし)' }).count()) === 1, `${tag} マスは日付と問題の数を読み上げる (数の記録の無い日も学んだと出す)`);
  check((await cal.locator('[title="11月24日(火) 20 問"]').count()) === 1, `${tag} マスに title がある`);
  check(await page.getByRole('img', { name: /11\/26 1 問/ }).isVisible(), `${tag} この先 14 日の復習の件数が出る`);
  check(await page.getByText(/Kubernetes Fundamentals \(\d+ 問\)/).isVisible() && (await page.getByText(/間違えた \(直近\) 1 \(/).count()) === 1, `${tag} 問題ごとの到達を分野ごとに数と割合で出す`);
  // 学習のまとめのカード: 押すと描き (部品は押したときに読む)、1080×1350 の PNG を保存できる
  await page.getByRole('button', { name: 'まとめのカードを作る' }).click();
  const card = page.getByRole('img', { name: /^クラネイの学習のまとめ。/ });
  await card.waitFor();
  const alt = await card.getAttribute('alt');
  check(/2026\/11\/09〜2026\/11\/25 \(17 日\) に 15 日学び、2 問を解いた。連続 15 日/.test(alt) && !/w1-|受験/.test(alt), `${tag} まとめのカードの説明に期間・学んだ日・解いた問題・連続が入り、問題の id は入らない (${alt.slice(0, 60)})`);
  const [cardFile] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: '画像を保存' }).click()]);
  const png = readFileSync(await cardFile.path());
  check(png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1350 && cardFile.suggestedFilename() === 'kcna-summary-2026-11-25.png', `${tag} まとめのカードを 1080×1350 の PNG で保存できる (${png.readUInt32BE(16)}×${png.readUInt32BE(20)})`);
  await noHorizontalOverflow(page, width, `${tag} 進捗`);
  await page.goto(`${BASE}settings/`);
  await page.getByRole('heading', { name: 'カレンダーに学ぶ予定を入れる' }).waitFor();
  check((await page.getByRole('checkbox', { checked: true }).count()) === 3, `${tag} 週の目標 3 日なら、曜日を 3 つ選んでおく`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '予定をダウンロード (.ics)' }).click()]);
  const ics = readFileSync(await download.path(), 'utf8');
  check(download.suggestedFilename().endsWith('.ics') && ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n') && /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/.test(ics) && /BEGIN:VTIMEZONE/.test(ics), `${tag} 設定から学ぶ予定の .ics を保存できる`);
  await noHorizontalOverflow(page, width, `${tag} 設定`);
  // 前の版の記録 (札・solved・run・週の目標の無い形) を読ませても落ちない
  await page.evaluate(() => localStorage.setItem('kcna.v1', JSON.stringify({ v: 1, streak: { count: 2, lastDay: '2026-11-24' }, xp: { total: 6, byDay: { '2026-11-24': 6 } }, lessons: {}, answers: { x: { right: 1, wrong: 0, last: '' } } })));
  await page.goto(`${BASE}progress/`);
  await page.getByRole('list', { name: /過去 26 週の学んだ日/ }).waitFor();
  check(await page.getByText('0 / 2').first().isVisible(), `${tag} 前の版の記録は休みの札 0 個で読む`);
  check(errors.length === 0, `${tag} 画面のエラーが無い (${errors.join(' / ')})`);
  await context.close();
}

/**
 * ページごとの OG 画像 (scripts/og-images.mjs) のつなぎ込み: 検索に載るページ (sitemap) の og:image・twitter:image が、
 * dist/og に実在する 1200×630 の PNG を指す。トップと noindex のページ (進捗) はサイト共通の画像のまま
 */
function checkOgImages() {
  const dist = new URL('../dist/', import.meta.url);
  const site = 'https://maco165.github.io/kcna-dojo/';
  const locs = [...readFileSync(new URL('sitemap.xml', dist), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].slice(site.length)).filter((p) => p !== '');
  const bad = [];
  for (const p of locs) {
    const html = readFileSync(new URL(`${p}index.html`, dist), 'utf8');
    const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? '';
    const tw = html.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1] ?? '';
    const file = og.startsWith(`${site}og/`) ? new URL(og.slice(site.length), dist) : null;
    let ok = file !== null && tw === og;
    if (ok) {
      try {
        const png = readFileSync(file);
        ok = png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630;
      } catch {
        ok = false;
      }
    }
    if (!ok) bad.push(p);
  }
  check(locs.length > 200 && bad.length === 0, `検索に載る ${locs.length} ページの og:image・twitter:image は、そのページの 1200×630 の PNG (違うもの ${bad.length}: ${bad.slice(0, 3).join(' ')})`);
  const shared = (p) => readFileSync(new URL(`${p}index.html`, dist), 'utf8').includes(`<meta property="og:image" content="${site}og-image.png"`);
  check(shared('') && shared('progress/'), 'トップと noindex のページ (進捗) の og:image はサイト共通の画像のまま');
}

async function run(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const tag = `[${name}]`;

  // 1. 空の localStorage のホーム
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'コンテナの基礎' }).waitFor();
  const startLinks = page.getByRole('link', { name: '開始' });
  const lessonLinks = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/kcna-dojo/lesson/"]')].map((a) => a.getAttribute('href')))]);
  check(lessonLinks.length === week1.lessons.length, `${tag} 空の記録でも全部のレッスンを開ける (${lessonLinks.length} / ${week1.lessons.length})`);
  check((await startLinks.count()) === 1, `${tag} ホームの「開始」は 1 つだけ`);
  check((await startLinks.first().getAttribute('href')) === `/kcna-dojo/lesson/${l1.id}/`, `${tag} 「開始」は最初のレッスン`);
  check(await page.getByText('0 / 30 XP').isVisible(), `${tag} 今日の目標は 0 / 30 XP`);
  check((await page.title()).startsWith('クラネイ'), `${tag} ページの題がクラネイで始まる`);
  check(await page.getByText('クラネイ', { exact: true }).first().isVisible(), `${tag} サイト名クラネイが出る`);
  const preRead = page.getByRole('navigation', { name: '先に読むハンドブック' });
  check((await preRead.locator('a[href="/kcna-dojo/handbook/containerization/"]').count()) === 1, `${tag} ホームに、その週で先に読むハンドブックのトピックが出る`);
  // 受験日と週の日付は運営者の予定に固定しない: 受験日を決めるまで日数を出さず設定へ案内し、週の日付は今日 (まだ学んでいない人の開始日) から数える
  check((await page.getByRole('link', { name: '受験日を決める' }).getAttribute('href')) === '/kcna-dojo/settings/' && (await page.getByText(/試験まで \d+ 日/).count()) === 0, `${tag} 受験日を決めるまで試験までの日数を出さず、設定へのリンクを出す`);
  const md = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const weekDates = width >= 768 ? `${md(0)}〜${md(6)}` : `${md(7)}〜`;
  check(await page.getByText(weekDates, { exact: false }).first().isVisible(), `${tag} 週の日付は今日から数える (${weekDates})`);
  await noHorizontalOverflow(page, width, `${tag} ホーム`);

  // 2. 4 択のレッスンを解く (1 問目は不正解、残りは正解)
  await startLinks.first().click();
  for (const [i, q] of l1.questions.entries()) {
    const wrong = q.choices.find((c) => c.id !== q.answer).id;
    const pick = i === 0 ? wrong : q.answer;
    await page.getByRole('radio', { name: choiceLabel(q, pick) }).check();
    if (i === 0) check((await page.getByRole('navigation', { name: '読み直す' }).count()) === 0, `${tag} 答える前には読み直す先を出さない`);
    await page.getByRole('button', { name: '確かめる' }).click();
    if (i === 0) {
      check(await page.getByText('不正解 · 正しくは').isVisible(), `${tag} 不正解のとき知らせが出る`);
      // 「正しくは X」の記号が、画面の並びでの正解の位置と合う
      const answerLabel = (await page.getByText(choiceLabel(q, q.answer)).first().textContent()) ?? '';
      const answerLetter = answerLabel.trim().slice(0, 1);
      check(/^[A-D]$/.test(answerLetter) && (await page.getByText(`不正解 · 正しくは ${answerLetter}`).isVisible()), `${tag} 「正しくは ${answerLetter}」が画面の並びと合う`);
      check(await page.getByText(q.explanation).isVisible(), `${tag} 不正解のとき解説が出る`);
      // 誤答のあと、選択肢の上に正解と選んだ答えを印と文字で示す (色だけに頼らない)。押せなくなって薄く描かれても、札の文字のコントラストは 4.5 以上
      const marks = await page.evaluate(() => {
        const toRgb = (c) => {
          const cv = document.createElement('canvas');
          cv.width = cv.height = 1;
          const x = cv.getContext('2d');
          x.fillStyle = c;
          x.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = x.getImageData(0, 0, 1, 1).data;
          return [r, g, b, a / 255];
        };
        const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
        const page = toRgb(getComputedStyle(document.body).backgroundColor);
        return [...document.querySelectorAll('.choice-mark')].map((el) => {
          let alpha = 1;
          for (let n = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
          const st = getComputedStyle(el);
          const bgRaw = toRgb(st.backgroundColor);
          const bg = mix(mix(bgRaw, page, bgRaw[3]), page, alpha);
          const fg = mix(toRgb(st.color), page, alpha);
          const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
          // 札の付いた選択肢 (radio を持ついちばん近い祖先) の文
          let row = el.parentElement;
          while (row && !row.querySelector('input[type="radio"]')) row = row.parentElement;
          return { text: el.textContent, row: row?.textContent ?? '', ratio: (l1 + 0.05) / (l2 + 0.05) };
        });
      });
      const answerText = q.choices.find((c) => c.id === q.answer).text;
      const pickedText = q.choices.find((c) => c.id === wrong).text;
      check(marks.length === 2 && marks.some((m) => m.text === '○ 正解') && marks.some((m) => m.text === '× 選んだ答え'), `${tag} 誤答のあと、正解と選んだ答えに印と文字の札が付く (${marks.map((m) => m.text).join('・')})`);
      check(marks.every((m) => m.ratio >= 4.5), `${tag} 札の文字のコントラストが 4.5 以上 (${marks.map((m) => m.ratio.toFixed(2)).join('・')})`);
      check(marks.find((m) => m.text === '○ 正解')?.row.includes(answerText) && marks.find((m) => m.text === '× 選んだ答え')?.row.includes(pickedText), `${tag} 札は正解の選択肢と選んだ選択肢に付く`);
      // 解説の近くに、問題の id・レッスン・ページの URL を入れた GitHub の新しい Issue へのリンク (答えや記録は入れない)
      const report = new URL((await page.getByRole('link', { name: /この問題の誤りを報告/ }).getAttribute('href')) ?? 'about:blank');
      const reportBody = report.searchParams.get('body') ?? '';
      check(
        report.href.startsWith('https://github.com/maco165/kcna-dojo/issues/new?') && report.searchParams.get('title')?.includes(q.id) && reportBody.includes(`(${l1.id})`) && reportBody.includes(`https://maco165.github.io/kcna-dojo/lesson/${l1.id}/`) && !reportBody.includes('kcna.v1'),
        `${tag} 誤りを報告のリンクに問題の id・レッスン・ページの URL が入る`,
      );
      // 答えたあとに、読み直す先 (ハンドブック・用語集) が出る。答える前には出さない
      const readMore = page.getByRole('navigation', { name: '読み直す' });
      await readMore.waitFor({ timeout: 5000 }).catch(() => {});
      const hbLinks = await readMore.locator('a[href*="/handbook/"]').count();
      const glLinks = await readMore.locator('a[href*="/glossary/"]').count();
      check(hbLinks + glLinks >= 1, `${tag} 答えたあとに読み直す先が出る (ハンドブック ${hbLinks}・用語集 ${glLinks})`);
      await noHorizontalOverflow(page, width, `${tag} 4 択の解説`);
    } else {
      check(await page.getByText('正解', { exact: true }).isVisible(), `${tag} ${q.id} 正解の知らせ`);
    }
    const isLast = i === l1.questions.length - 1;
    await page.getByRole('button', { name: isLast ? '結果を見る' : '次へ' }).click();
  }
  await page.getByRole('heading', { name: 'レッスン完了' }).waitFor();
  const total = l1.questions.length;
  check(await page.getByText(`${total - 1} / ${total}`).isVisible(), `${tag} 完了画面の正答数 ${total - 1} / ${total}`);
  await noHorizontalOverflow(page, width, `${tag} 完了画面`);
  await checkShare(page, `${tag} レッスン完了`, `${total - 1} / ${total} 問正解`, `https://maco165.github.io/kcna-dojo/lesson/${l1.id}/`);
  await noHorizontalOverflow(page, width, `${tag} 完了画面の共有`);

  // 3. ホームへ戻る
  await page.getByRole('link', { name: '一覧へ戻る' }).click();
  await page.getByRole('heading', { name: 'コンテナの基礎' }).waitFor();
  const xp = (total - 1) * 3;
  const doneText = width >= 768 ? `${total - 1} / ${total}` : '完了';
  check(await page.getByText(doneText, { exact: true }).first().isVisible(), `${tag} 1 つ目が完了になる (${doneText})`);
  check(
    (await page.getByRole('link', { name: '開始' }).first().getAttribute('href')) === `/kcna-dojo/lesson/${l2.id}/`,
    `${tag} 「開始」が 2 つ目に移る`,
  );
  check(await page.getByText(`${xp} / 30 XP`).isVisible(), `${tag} 今日の目標が ${xp} XP に増える`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(stored?.lessons?.[l1.id]?.done === true && stored?.streak?.count === 1, `${tag} localStorage の kcna.v1 に完了と連続 1 日が残る`);

  // 4. コマンドの穴埋め (打ち込んで Enter)
  await page.goto(`${BASE}lesson/w1-l3/`);
  const input = page.getByRole('textbox', { name: '空欄' });
  await input.fill('get');
  await input.press('Enter');
  check(await page.getByText('正解', { exact: true }).isVisible(), `${tag} 穴埋めを Enter で確かめると正解`);
  check(await page.getByText('実行結果の例').isVisible(), `${tag} 正解のあと実行結果の例が出る`);
  await noHorizontalOverflow(page, width, `${tag} 穴埋め`);

  // 4a. 答えたあと、AI に聞くリンクの上の Enter では進まず、それ以外の Enter で次へ進む
  await page.getByRole('link', { name: 'Claude' }).focus();
  const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 5000 }).catch(() => null), page.keyboard.press('Enter')]);
  await popup?.close();
  check(await page.getByText(`${l3.title} · 1 / ${l3.questions.length} 問`).isVisible(), `${tag} AI のリンクの上の Enter では次へ進まない`);
  await page.locator('body').focus();
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press('Enter');
  check(await page.getByText(`${l3.title} · 2 / ${l3.questions.length} 問`).isVisible(), `${tag} 答えたあと Enter で次へ進む`);
  await page.goto(`${BASE}lesson/w1-l3/`);
  await page.reload();
  // 説明の部品は問題を開いたときに先に読むので、読み込みが落ち着いてから数える (答える前には出さない)
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  check((await page.locator('.cmd-notes').count()) === 0, `${tag} 答える前には出てきたコマンドを出さない`);
  await page.getByRole('textbox', { name: '空欄' }).fill('get');
  await page.getByRole('textbox', { name: '空欄' }).press('Enter');
  // 答えたあと、出てきたコマンド (kubectl get) の説明・使ったオプション・公式リファレンスが出る
  const notes = page.locator('.cmd-notes');
  await notes.waitFor({ timeout: 5000 }).catch(() => {});
  check((await notes.locator('.cmd-note__name').allInnerTexts()).includes('kubectl get'), `${tag} 答えたあとに出てきたコマンドの説明が出る`);
  check((await notes.locator('.cmd-note__flags dt').allInnerTexts()).some((t) => t.startsWith('-n')) && (await notes.locator('.cmd-note__flags dt').allInnerTexts()).some((t) => t.startsWith('-o')), `${tag} 問題で使ったオプション (-n・-o) の説明が出る`);
  check((await notes.locator('a[href^="https://kubernetes.io/docs/reference/kubectl/generated/kubectl_get/"]').count()) === 1, `${tag} 公式リファレンスへのリンクがある`);
  await noHorizontalOverflow(page, width, `${tag} 出てきたコマンド`);

  // 4b. 候補を押して不正解なら、なぜ違うかが出る (2 問目は describe が正解なので get を押す)
  await page.getByRole('button', { name: '次へ' }).click();
  const q2 = l3.questions[1];
  if (q2.type === 'choice') {
    // l3 の 2 問目は 4 択なので飛ばし、3 問目以降の穴埋めへ進む
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '確かめる' }).click();
    await page.getByRole('button', { name: '次へ' }).click();
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '確かめる' }).click();
    await page.getByRole('button', { name: '次へ' }).click();
  }
  const q4 = l3.questions[3];
  await page.getByRole('button', { name: 'get', exact: true }).click();
  await page.getByRole('button', { name: '確かめる' }).click();
  check(await page.getByText(q4.wrongNotes.get).isVisible(), `${tag} 穴埋めの不正解で、選んだ候補がなぜ違うかが出る`);

  // 7. AI に聞くリンク
  const claudeHref = await page.getByRole('link', { name: 'Claude' }).getAttribute('href');
  const chatgptHref = await page.getByRole('link', { name: 'ChatGPT' }).getAttribute('href');
  const asked = new URL(claudeHref).searchParams.get('q') ?? '';
  check(claudeHref.startsWith('https://claude.ai/new?q=') && asked.includes(q4.prompt), `${tag} Claude のリンクに問題文が入る`);
  check(asked.includes('私の答えは get で不正解'), `${tag} 答えたあとのリンクには自分の答えが入る`);
  check(chatgptHref.startsWith('https://chatgpt.com/?q='), `${tag} ChatGPT のリンクがある`);
  // 文をコピー: Claude と ChatGPT に入る文と同じ文をクリップボードへ写し、「コピーしました」と出す
  check(new URL(chatgptHref).searchParams.get('q') === asked, `${tag} Claude と ChatGPT のリンクには同じ文が入る`);
  await page.evaluate(() => {
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } });
  });
  await page.getByRole('button', { name: /プロンプトをコピー/ }).first().click();
  await page.getByText('コピーしました').first().waitFor({ timeout: 3000 }).catch(() => {});
  check((await page.evaluate(() => window.__copied)) === asked && (await page.getByText('コピーしました').first().isVisible()), `${tag} 文をコピーのボタンで、リンクと同じ文が写り、コピーしましたと出る`);
  // クリップボードが使えないときは、文を見せて手でコピーしてもらう
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    document.execCommand = () => false;
  });
  await page.getByRole('button', { name: /プロンプトをコピー/ }).first().click();
  const shown = page.getByRole('textbox', { name: /の文$/ }).first();
  await shown.waitFor({ timeout: 3000 }).catch(() => {});
  check((await shown.inputValue().catch(() => '')) === asked, `${tag} コピーできないときは、同じ文を選べる形で見せる`);
  await page.goto(`${BASE}lesson/w1-l1/`);
  const before = new URL(await page.getByRole('link', { name: 'Claude' }).getAttribute('href')).searchParams.get('q') ?? '';
  check(before.includes(l1.questions[0].prompt) && !before.includes('正解は'), `${tag} 答える前のリンクには正解を入れない`);

  // 5. もう一度解く (全問を最初の選択肢で答え、数え直しを確かめる)
  for (const [i] of l1.questions.entries()) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '確かめる' }).click();
    await page.getByRole('button', { name: i === l1.questions.length - 1 ? '結果を見る' : '次へ' }).click();
  }
  await page.getByRole('button', { name: 'もう一度解く' }).click();
  check(await page.getByText(`${l1.title} · 1 / ${l1.questions.length} 問`).isVisible(), `${tag} やり直すと 1 問目から始まる`);

  // 6. 実習
  await page.goto(`${BASE}lesson/${lab.id}/`);
  const finish = page.getByRole('button', { name: '完了にする' });
  check(await finish.isDisabled(), `${tag} 実習は印を付けるまで完了にできない`);
  const prep = page.getByRole('region', { name: '始める前に' });
  check((await prep.getByText('この実習で分かること').count()) === 1 && (await prep.locator('a[href="/kcna-dojo/handbook/setup-k3s/"]').count()) === 1 && (await prep.locator('a[href="/kcna-dojo/handbook/containerization/"]').count()) === 1, `${tag} 実習の頭に、分かること・用意するもの・k3s の入れ方・先に読むトピックが出る`);
  check((await page.locator('.lab-step__tag--ok').count()) === lab.steps.filter((s) => s.command).length, `${tag} 実習の打つ手順ごとに「うまくいくと」が出る`);
  const labAsk = await page.getByRole('link', { name: 'Claude' }).first().getAttribute('href');
  const labAsked = decodeURIComponent(labAsk.split('?q=')[1]);
  check((await page.getByRole('link', { name: 'Claude' }).count()) === lab.steps.length && labAsk.startsWith('https://claude.ai/new?q=') && labAsked.includes(lab.steps[0].text) && labAsked.includes(lab.title), `${tag} 実習の手順ごとに、手順の文を入れた AI を開ける`);
  await noHorizontalOverflow(page, width, `${tag} 実習`);
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await finish.click();
  await page.getByRole('heading', { name: 'レッスン完了' }).waitFor();
  const labStored = await page.evaluate((id) => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null')?.lessons?.[id]?.done, lab.id);
  check(labStored === true, `${tag} 実習を全部の印で完了にすると記録が残る`);
  await noHorizontalOverflow(page, width, `${tag} 実習の完了`);

  // 9. このサイトについて と リポジトリへのリンク
  await page.goto(BASE);
  const repoLinks = page.locator('a[href="https://github.com/maco165/kcna-dojo"]');
  check((await repoLinks.count()) >= 1, `${tag} ホームにリポジトリへのリンクがある`);
  const repoSameTab = await repoLinks.evaluateAll((as) => as.filter((a) => a.target !== '_blank' || !/noopener/.test(a.rel)).length);
  check(repoSameTab === 0, `${tag} リポジトリへのリンクはすべて別タブで開く`);
  await page.goto(`${BASE}about/`);
  await page.getByRole('heading', { name: 'このサイトについて' }).waitFor();
  const repoButton = page.getByRole('link', { name: /GitHub のリポジトリを開く/ }).first();
  check((await repoButton.getAttribute('href')) === 'https://github.com/maco165/kcna-dojo', `${tag} このサイトについてにリポジトリへのボタンがある`);
  check((await page.getByRole('link', { name: /Issue を書く/ }).getAttribute('href')) === 'https://github.com/maco165/kcna-dojo/issues/new', `${tag} Issue を書くリンクがある`);
  const logoOk = await page.evaluate(() => [...document.querySelectorAll('img.site-logo')].every((i) => i.complete && i.naturalWidth > 0));
  check(logoOk, `${tag} サイト名の横の印が読み込める`);
  check(await page.getByText(/非公式の学習サイト/).isVisible(), `${tag} このサイトについてに非公式と書いてある`);
  await noHorizontalOverflow(page, width, `${tag} このサイトについて`);

  // 9b. 復習: 予定が今日の問題を 2 つ入れて、復習の画面から解く
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('kcna.v1') ?? '{"v":1}');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    p.answers = { ...(p.answers ?? {}), 'w1-l1-q1': { right: 0, wrong: 1, last: '', stage: 0, nextReview: today }, 'w1-l2-q4': { right: 0, wrong: 1, last: '', stage: 0, nextReview: today } };
    localStorage.setItem('kcna.v1', JSON.stringify(p));
  });
  await page.goto(`${BASE}review/`);
  await page.reload();
  await page.getByRole('heading', { name: '今日の復習 2 問' }).waitFor();
  check(true, `${tag} 復習の画面に今日の 2 問が出る`);
  await page.getByRole('button', { name: '復習を始める' }).click();
  // 1 問目 (4 択) は正解を選ぶ、2 問目 (穴埋め) は正解を打つ
  const rq1 = l1.questions[0];
  await page.getByRole('radio', { name: choiceLabel(rq1, rq1.answer) }).check();
  await page.getByRole('button', { name: '確かめる' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('textbox', { name: '空欄' }).fill('build');
  await page.getByRole('button', { name: '確かめる' }).click();
  await page.getByRole('button', { name: '結果を見る' }).click();
  await page.getByRole('heading', { name: 'レッスン完了' }).waitFor();
  const afterReview = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(afterReview?.answers?.['w1-l1-q1']?.stage === 1 && afterReview?.answers?.['w1-l2-q4']?.stage === 1, `${tag} 復習で正解すると次は 3 日後になる (stage 1)`);
  await page.getByRole('button', { name: '一覧へ戻る' }).click();
  await page.getByRole('heading', { name: '今日の復習 0 問' }).waitFor();
  check(await page.getByText(/今日の復習はありません。次は/).isVisible(), `${tag} 終えると今日の復習は 0 で、次の予定が出る`);

  // 9b1. 問題ごとの解いた記録: 前に解いた問題には回数と最後の日が、初めての問題には「はじめて」が出る
  {
    await page.goto(`${BASE}#/lesson/w1-l1`);
    await page.getByRole('button', { name: '確かめる' }).waitFor();
    check(await page.getByText(/これまで \d+ 回 \(正解 \d+・不正解 \d+\) · 最後 \d+\/\d+/).first().isVisible(), `${tag} 前に解いた問題に、解いた回数と最後の日が出る`);
    await page.goto(`${BASE}#/lesson/w8-l4`);
    await page.getByRole('button', { name: '確かめる' }).waitFor();
    check(await page.getByText('はじめて').first().isVisible(), `${tag} 初めての問題には「はじめて」と出る`);
    // w1-l1 を全問正解で解き直す: 答えても見出しは始めたときのまま、結果の一覧は答えたあと、もう一度解くと 1 回分増える
    await page.goto(`${BASE}lesson/w1-l1/`);
    await page.getByRole('button', { name: '確かめる' }).waitFor();
    const head = () => page.locator('.lesson__main').getByText(/はじめて|これまで \d+ 回/).first().innerText();
    const times = (t) => Number(t.match(/これまで (\d+) 回/)?.[1] ?? 0);
    const first = await head();
    for (const [i, q] of l1.questions.entries()) {
      await page.getByRole('radio', { name: choiceLabel(q, q.answer) }).check();
      await page.getByRole('button', { name: '確かめる' }).click();
      if (i === 0) check((await head()) === first, `${tag} 答えても、見出しの記録は始めたときのまま`);
      await page.getByRole('button', { name: i === l1.questions.length - 1 ? '結果を見る' : '次へ' }).click();
    }
    await page.getByRole('heading', { name: 'レッスン完了' }).waitFor();
    check(await page.getByText(new RegExp(`これまで ${times(first) + 1} 回`)).first().isVisible(), `${tag} 結果の一覧に、答えたあとの記録が出る`);
    await page.getByRole('button', { name: 'もう一度解く' }).click();
    await page.getByRole('button', { name: '確かめる' }).waitFor();
    check(times(await head()) === times(first) + 1, `${tag} もう一度解くと、1 回目の分を入れた記録が出る (${first} → ${await head()})`);
    await page.goto(`${BASE}#/review`);
  }

  // 9b2. ランダム出題: 分野と数を選んで始め、1 問答えると記録に入る
  {
    // 答えた回数の合計 (前の手順で答えた問題が選ばれても 1 つ増える)
    const countAnswers = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').answers ?? {}).reduce((n, a) => n + a.right + a.wrong, 0));
    await page.getByRole('heading', { name: 'ランダム出題' }).waitFor();
    await page.getByRole('radio', { name: /^Cloud Native Architecture \(\d+ 問\)/ }).check();
    await page.getByRole('radio', { name: '20 問', exact: true }).click();
    await page.getByRole('button', { name: '20 問を始める' }).click();
    await page.getByRole('button', { name: '確かめる' }).waitFor();
    check(await page.getByText('ランダム出題').first().isVisible(), `${tag} ランダム出題が始まる`);
    const before = await countAnswers();
    const box = page.getByRole('textbox', { name: '空欄' });
    if (await box.count()) await box.fill('x');
    else await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '確かめる' }).click();
    await page.getByRole('button', { name: /次へ|結果を見る/ }).waitFor();
    check((await countAnswers()) === before + 1, `${tag} ランダム出題で答えると記録に入る (${before} → ${await countAnswers()})`);
    await page.goto(`${BASE}week/1/`);
  }

  // 9c. 進捗の画面
  await page.goto(`${BASE}progress/`);
  await page.getByRole('heading', { name: '進捗' }).waitFor();
  check(await page.getByText('分野ごとの正答率').isVisible() && await page.getByText('この 7 日の XP').isVisible(), `${tag} 進捗の画面に正答率と 7 日の XP が出る`);
  check((await page.getByRole('link', { name: /第 1 週 コンテナの基礎/ }).count()) === 1, `${tag} 進捗の画面に週ごとの進み具合が出る`);
  check(await page.getByRole('img', { name: /今日 \d+ XP$/ }).isVisible(), `${tag} 7 日の XP の名前の最後が今日`);
  check(await page.getByText(/^(これから|予定どおり|\d+ レッスン遅れ)/).first().isVisible(), `${tag} 計画との差が出る`);
  await noHorizontalOverflow(page, width, `${tag} 進捗`);

  // 10. 設定: 目標を変える・書き出す・読み込む・記録を消す
  await page.goto(`${BASE}settings/`);
  await page.getByRole('heading', { name: '設定' }).waitFor();
  await page.getByRole('radio', { name: '10 XP' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(saved?.profile?.dailyGoalXp === 10, `${tag} 1 日の目標を 10 XP にすると記録に残る`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '記録を書き出す (JSON)' }).click()]);
  check(/^kcna-progress-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), `${tag} 記録を書き出すと日付入りの JSON が保存される`);
  const exported = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
  check(exported.v === 1 && exported.profile?.dailyGoalXp === 10, `${tag} 書き出した中身が今の記録と同じ`);
  // 途中の模擬試験の保存も、記録を消すと消える
  await page.evaluate(() => localStorage.setItem('kcna.exam.v1', '{"v":1,"id":"e2e"}'));
  await page.getByRole('button', { name: '記録を消す' }).click();
  await page.getByRole('button', { name: '消す', exact: true }).click();
  check(await page.evaluate(() => localStorage.getItem('kcna.exam.v1') === null), `${tag} 記録を消すと途中の模擬試験の保存も消える`);
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(Object.keys(cleared?.lessons ?? {}).length === 0 && cleared?.profile?.dailyGoalXp === 10, `${tag} 記録を消すと進捗は空で、目標は残る`);
  await page.locator('input[type="file"]').setInputFiles({ name: 'back.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.getByRole('button', { name: '置き換える' }).click();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(JSON.stringify(restored?.lessons) === JSON.stringify(exported.lessons), `${tag} 書き出したファイルを読み込むと記録が戻る`);
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'コンテナの基礎' }).waitFor();
  check(await page.getByText(/ \/ 10 XP/).first().isVisible(), `${tag} ホームの今日の目標が 10 XP になる`);
  await noHorizontalOverflow(page, width, `${tag} 設定`);

  // 11. 模擬試験: 60 問・90 分。1 問だけ答えて採点し、結果と記録と復習を見る
  // 模擬試験で間違えた初見の問題 (x-) も、復習の画面に「模擬試験の問題」として出る
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('kcna.v1') ?? '{"v":1}');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    p.answers = { ...(p.answers ?? {}), 'x-fd1-001': { right: 0, wrong: 1, last: '', stage: 0, nextReview: today } };
    localStorage.setItem('kcna.v1', JSON.stringify(p));
  });
  await page.goto(`${BASE}review/`);
  await page.reload();
  await page.getByRole('heading', { name: /今日の復習 \d+ 問/ }).waitFor();
  check(await page.getByText('模擬試験の問題', { exact: true }).first().isVisible(), `${tag} 模擬試験の初見の問題も復習の一覧に出る`);
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('kcna.v1'));
    delete p.answers['x-fd1-001'];
    localStorage.setItem('kcna.v1', JSON.stringify(p));
  });
  await page.goto(`${BASE}exam/`);
  await page.getByRole('heading', { name: '模擬試験' }).waitFor();
  const answersBefore = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').answers ?? {}).length);
  check((await page.getByRole('radio', { name: /^(第 [1-5] 回|ランダム)/ }).count()) === 6, `${tag} 模擬試験は第 1〜5 回とランダムから選べる`);
  check(await page.getByText(/第 4・5 回はレッスンに無い初見の問題/).isVisible(), `${tag} 第 4・5 回は初見の問題と書く`);
  // 第 4 回 (初見の問題だけの回) も 60 問で始まる
  await page.getByRole('radio', { name: /^第 4 回/ }).check();
  await page.getByRole('button', { name: '第 4 回を始める' }).click();
  check(await page.getByText(/模擬試験 · 1 \/ 60 問/).isVisible(), `${tag} 第 4 回は初見の問題で 60 問始まる`);
  await page.goto(`${BASE}exam/`);
  await page.getByRole('heading', { name: '模擬試験' }).waitFor();
  await page.getByRole('radio', { name: /^第 1 回/ }).check();
  await page.getByRole('button', { name: '第 1 回を始める' }).click();
  check(await page.getByText(/模擬試験 · 1 \/ 60 問/).isVisible(), `${tag} 模擬試験は 60 問`);
  check(await page.getByText(/残り (90:00|89:5\d)/).isVisible(), `${tag} 残り時間が 90 分から始まる`);
  const firstRadio = page.getByRole('radio').first();
  if (await firstRadio.count()) await firstRadio.check();
  else await page.getByRole('textbox', { name: '空欄' }).fill('x');
  await page.getByRole('button', { name: '次へ' }).click();
  check(await page.getByText(/模擬試験 · 2 \/ 60 問 · 答えた 1/).isVisible(), `${tag} 次へで 2 問目に進み、答えた数が数えられる`);
  // 2 問目に「あとで見直す」の印を付ける。印は途中の保存にも入る
  await page.getByRole('button', { name: 'あとで見直す' }).click();
  check(await page.waitForFunction(() => JSON.stringify(JSON.parse(localStorage.getItem('kcna.exam.v1') ?? '{}').marks) === '[1]').then(() => true, () => false), `${tag} 見直す印を途中の保存に入れる`);
  // 途中で再読み込みしても、続きから解ける (回・答え・いまの問題・期限を保存する)
  const secondPrompt = await page.locator('main h1, main h2').first().textContent();
  const savedEndsAt = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.exam.v1') ?? '{}').endsAt);
  await page.reload();
  await page.getByText('途中の第 1 回があります').waitFor();
  check(await page.getByText(/60 問のうち 1 問に答えています/).isVisible(), `${tag} 再読み込みすると、途中の模擬試験の答えた数を出す`);
  await page.getByRole('button', { name: '続きから解く' }).click();
  check(await page.getByText(/模擬試験 · 2 \/ 60 問 · 答えた 1/).isVisible(), `${tag} 続きから解くと、同じ問題・同じ答えた数から始まる`);
  check(typeof savedEndsAt === 'number' && (await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.exam.v1') ?? '{}').endsAt)) === savedEndsAt, `${tag} 続きから解いても残り時間の期限は最初のまま`);
  check((await page.locator('main h1, main h2').first().textContent()) === secondPrompt, `${tag} 続きから解くと、閉じる前と同じ問題が出る`);
  check((await page.getByRole('button', { name: 'あとで見直す' }).getAttribute('aria-pressed')) === 'true', `${tag} 続きから解くと見直す印も戻る`);
  // 問題の一覧: 60 問のボタンが状態を読み上げ、押すとその問題へ移る
  await page.getByRole('button', { name: /^問題の一覧 \(未回答 59 · 印 1\)$/ }).click();
  const nav = page.getByRole('navigation', { name: '問題の一覧' });
  check((await nav.getByRole('button').count()) === 60, `${tag} 問題の一覧に 60 問のボタンがある`);
  check((await nav.getByRole('button', { name: '1 問目 回答済み' }).count()) === 1 && (await nav.getByRole('button', { name: '2 問目 未回答・見直す印あり・表示中' }).count()) === 1, `${tag} 問題の一覧は回答済み・未回答・印を文字で読み上げる`);
  await noHorizontalOverflow(page, width, `${tag} 模擬試験の問題の一覧`);
  await nav.getByRole('button', { name: /^1 問目/ }).click();
  check(await page.getByText(/模擬試験 · 1 \/ 60 問/).isVisible(), `${tag} 問題の一覧から好きな問題へ移れる`);
  await page.getByRole('button', { name: '採点する' }).first().click();
  check(await page.getByText(/まだ答えていない問題が 59 問あります/).isVisible(), `${tag} 採点の前に答えていない数を知らせる`);
  check(await page.getByText(/「あとで見直す」の印が 1 問に付いています/).isVisible(), `${tag} 採点の前に見直す印の数を知らせる`);
  await page.getByRole('button', { name: '採点する' }).last().click();
  await page.getByRole('heading', { name: '結果' }).waitFor();
  const afterExam = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  {
    const e = afterExam?.exams?.[0];
    if (e) await checkShare(page, `${tag} 模擬試験の結果`, `${e.correct} / ${e.total} 問 (${Math.round((e.correct / e.total) * 100)}%)`, 'https://maco165.github.io/kcna-dojo/exam/');
  }
  check(afterExam?.exams?.length === 1 && afterExam.exams[0].total === 60 && afterExam.exams[0].set === 1, `${tag} 模擬試験の結果が回の番号つきで記録に残る`);
  const answersAdded = Object.keys(afterExam?.answers ?? {}).length - answersBefore;
  check(answersAdded <= 1, `${tag} 答えなしの問題は記録しない (増えた記録 ${answersAdded})`);
  // ほぼ答えずに採点したので、4 分野とも目安に届かず、分野ごとに読み直すトピックが出る
  const weak = page.getByRole('navigation', { name: '弱い分野を読み直す' });
  await weak.waitFor({ timeout: 5000 }).catch(() => {});
  check((await weak.locator('a[href*="/handbook/"]').count()) >= 4, `${tag} 模擬試験の結果に、弱い分野の読み直すトピックが出る`);
  await noHorizontalOverflow(page, width, `${tag} 模擬試験の結果`);
  await page.getByRole('button', { name: '模擬試験の最初へ戻る' }).click();
  check(await page.getByText(/前回 \d+ \/ 60/).first().isVisible(), `${tag} 第 1 回の前回の結果が回の選択に出る`);
  // やめるときは確かめる (ランダムの回で)
  await page.getByRole('radio', { name: /^ランダム/ }).check();
  await page.getByRole('button', { name: 'ランダムを始める' }).click();
  await page.getByRole('button', { name: '模擬試験をやめる' }).click();
  check(await page.getByText('ここまでの答えは残らず').isVisible(), `${tag} 模擬試験をやめる前に確かめる`);
  await page.getByRole('button', { name: '続ける' }).click();
  check(await page.getByText(/模擬試験 · 1 \/ 60 問/).isVisible(), `${tag} 続けるを選ぶと試験に戻る`);
  await page.getByRole('button', { name: '模擬試験をやめる' }).click();
  await page.getByRole('button', { name: 'やめる', exact: true }).click();
  await page.getByRole('button', { name: /を始める$/ }).waitFor();
  check(await page.evaluate(() => localStorage.getItem('kcna.exam.v1') === null), `${tag} 模擬試験をやめたら途中の保存を消す`);
  // 途中で再読み込みして「やめて最初から」を選ぶと、保存を消して回の選択に戻る
  await page.getByRole('button', { name: /を始める$/ }).click();
  await page.reload();
  await page.getByRole('button', { name: 'やめて最初から' }).click();
  check((await page.getByRole('button', { name: '続きから解く' }).count()) === 0 && (await page.evaluate(() => localStorage.getItem('kcna.exam.v1') === null)), `${tag} やめて最初からで途中の保存を消す`);
  check(await page.getByText(/第 1 回 · \d+ \/ 60 \(\d+%\)/).first().isVisible(), `${tag} 模擬試験の画面にこれまでの結果が回の名前つきで出る`);
  await page.goto(`${BASE}progress/`);
  await page.getByRole('heading', { name: '進捗' }).waitFor();
  check(await page.getByText(/前回 \d+ \/ 60 問/).isVisible(), `${tag} 進捗の画面に模擬試験の前回の結果が出る`);

  // 13. 模擬試験の時間切れ: 時計を 90 分進めると自動で採点する
  {
    const tp = await context.newPage();
    tp.on('pageerror', (e) => errors.push(e.message));
    await tp.clock.install();
    await tp.goto(`${BASE}exam/`);
    const before = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    await tp.getByRole('button', { name: /を始める$/ }).click();
    await tp.clock.fastForward('01:30:02');
    await tp.getByRole('heading', { name: '結果' }).waitFor();
    await tp.clock.fastForward('00:00:10');
    const after = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    check(after === before + 1, `${tag} 時間切れで 1 回だけ自動で採点する (${before} → ${after})`);
    const lastSet = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.[0]?.set);
    check(lastSet === 2, `${tag} 時間切れの採点にも回の番号が残る (第 1 回を解いたあとは第 2 回が選ばれている: ${lastSet})`);
    check(await tp.evaluate(() => localStorage.getItem('kcna.exam.v1') === null), `${tag} 採点したら途中の保存を消す`);
    // 途中で閉じて、期限を過ぎてから開くと、続きからではなく時間切れの結果にする
    await tp.goto(`${BASE}exam/`);
    await tp.getByRole('button', { name: /を始める$/ }).click();
    await tp.getByText(/模擬試験 · 1 \/ 60 問/).waitFor();
    const before2 = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    await tp.goto('about:blank');
    await tp.clock.fastForward('01:31:00');
    await tp.goto(`${BASE}exam/`);
    await tp.getByRole('heading', { name: '結果' }).waitFor();
    const after2 = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    check(after2 === before2 + 1 && (await tp.evaluate(() => localStorage.getItem('kcna.exam.v1') === null)), `${tag} 期限を過ぎてから開くと時間切れの結果になり、保存を消す (${before2} → ${after2})`);
    // 「続きから解く」の案内を開いたまま期限が来たら、その場で時間切れの結果にする (前の回を記録せずに上書きしない)
    await tp.getByRole('button', { name: '模擬試験の最初へ戻る' }).click();
    await tp.getByRole('button', { name: /を始める$/ }).click();
    await tp.getByText(/模擬試験 · 1 \/ 60 問/).waitFor();
    await tp.reload();
    await tp.getByRole('button', { name: '続きから解く' }).waitFor();
    const before3 = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    await tp.clock.fastForward('01:31:00');
    await tp.getByRole('heading', { name: '結果' }).waitFor({ timeout: 10000 }).catch(() => {});
    const after3 = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    check(after3 === before3 + 1 && (await tp.evaluate(() => localStorage.getItem('kcna.exam.v1') === null)), `${tag} 案内を開いたまま期限が来ると、時間切れの結果を 1 回記録する (${before3} → ${after3})`);
    await tp.close();
  }

  // 12. 用語集: 検索・分野で絞る・開く・レッスンへのリンク (スマホは閉じた一覧、PC は一覧と説明の 2 列)
  await page.goto(`${BASE}glossary/`);
  await page.getByRole('heading', { name: '用語集', level: 1 }).waitFor();
  const isWide = width >= 768;
  const termButtons = isWide ? page.getByRole('navigation', { name: '用語の一覧' }).getByRole('button') : page.locator('.gloss-row__head');
  // 画面の部品は開いたときに読むので、一覧が出るまで待つ
  await termButtons.first().waitFor();
  check((await termButtons.count()) >= 70, `${tag} 用語集に 70 語以上ある`);
  {
    // 範囲外の札で、試験の範囲の外の語 (レッスンに出ない語) だけに絞れる
    await page.getByRole('button', { name: /^範囲外/ }).click();
    const outCount = await termButtons.count();
    // スマホの一覧の行は content-visibility: auto で、画面の外の行は描かれない (見えるかではなく、一覧にあるかを見る)
    check(outCount >= 20 && (await termButtons.filter({ hasText: 'Linux の namespaces' }).count()) >= 1, `${tag} 範囲外の札で、範囲外の語に絞れる (${outCount} 語)`);
    await page.getByRole('button', { name: /^すべて/ }).click();
  }
  await page.getByRole('button', { name: /^設計 \d+/ }).click();
  check((await page.getByRole('button', { name: /^設計 \d+/ }).getAttribute('aria-pressed')) === 'true', `${tag} 押した分野の札が押された状態になる`);
  const designCount = await termButtons.count();
  check(designCount > 0 && designCount < 30, `${tag} 分野で絞ると語が減る (${designCount})`);
  await page.getByRole('button', { name: /^すべて \d+/ }).click();
  await page.getByRole('searchbox', { name: '用語を探す' }).fill('ｋｕｂｅｌｅｔ');
  if (!isWide) {
    check((await page.locator('.gloss-row__head[aria-expanded="true"]').count()) === 0, `${tag} スマホの一覧は閉じて並ぶ`);
    await page.locator('.gloss-row__head').filter({ hasText: 'kubelet' }).first().click();
    check((await page.locator('.gloss-row__head[aria-expanded="true"]').count()) === 1, `${tag} 押すと 1 語だけ開く`);
  }
  check(await page.getByText('各ノードで動き').first().isVisible(), `${tag} 全角で探しても kubelet の説明が出る`);
  await page.getByRole('searchbox', { name: '用語を探す' }).fill('存在しない語ですzzz');
  check(await page.getByText('見つかりませんでした').isVisible(), `${tag} 見つからないときに知らせる`);
  await page.getByRole('searchbox', { name: '用語を探す' }).fill('etcd');
  if (!isWide) await page.locator('.gloss-row__head').first().click();
  await page.locator('.gloss-chip').first().click();
  await page.waitForURL(/\/lesson\//);
  check(page.url().includes('/lesson/'), `${tag} 用語集からレッスンへ飛べる`);
  await page.goto(`${BASE}glossary/`);
  await noHorizontalOverflow(page, width, `${tag} 用語集`);
  if (isWide) {
    // 768〜1000 幅でも説明欄が一覧の横 (画面の中) に出る
    const narrow = await context.newPage();
    await narrow.setViewportSize({ width: 900, height: 700 });
    await narrow.goto(`${BASE}glossary/`);
    await narrow.getByRole('navigation', { name: /用語の一覧/ }).getByRole('button').nth(5).click();
    const paneTop = await narrow.locator('.gloss-pane').evaluate((el) => el.getBoundingClientRect().top);
    check(paneTop < 700, `${tag} 900x700 でも説明欄が画面の中に出る (上端 ${Math.round(paneTop)})`);
    // 一覧は Tab で 1 語だけに止まり、下の矢印で次の語へ移る
    const first = narrow.getByRole('navigation', { name: /用語の一覧/ }).getByRole('button', { name: /./ });
    check((await narrow.locator('.gloss-index__item[tabindex="0"]').count()) === 1, `${tag} 一覧の Tab の止まり先は 1 語だけ`);
    await narrow.locator('.gloss-index__item[tabindex="0"]').focus();
    const before = await narrow.locator('#gloss-pane-term').innerText();
    await narrow.keyboard.press('ArrowDown');
    const after = await narrow.locator('#gloss-pane-term').innerText();
    check(before !== after && (await first.count()) > 0, `${tag} 下の矢印で次の語の説明に移る (${before} → ${after})`);
    await narrow.close();
  }

  // 13. 説明のページ: 見本の問題を解ける・数字が問題データと合う・左の一覧/ホームから入れる
  await page.goto(BASE);
  await page.getByRole('link', { name: /Kubernetes とこのサイト/ }).first().click();
  await page.getByRole('heading', { name: /問題を解きながら根っこから/, level: 1 }).waitFor();
  check(page.url().includes('/kcna-dojo/guide/'), `${tag} ホーム (左の一覧) から説明のページへ入れる`);
  await page.getByRole('button', { name: 'describe', exact: true }).click();
  check(await page.getByText('describe は違います').isVisible(), `${tag} 見本の問題で違う候補を選ぶと違うと出る`);
  await page.getByRole('button', { name: 'get', exact: true }).click();
  check(await page.getByText(/^正解。/).isVisible(), `${tag} 見本の問題で get を選ぶと正解と出る`);
  const questionCount = [1, 2, 3, 4, 5, 6, 7, 8]
    .map((n) => JSON.parse(readFileSync(new URL(`../src/content/week${n}.json`, import.meta.url), 'utf8')))
    .flatMap((w) => w.lessons)
    .reduce((s, l) => s + (l.questions?.length ?? 0), 0);
  check(await page.getByLabel('このサイトの中身').getByText(String(questionCount), { exact: true }).isVisible(), `${tag} 説明のページの問題の数が問題データと合う (${questionCount})`);
  check(await page.getByText('LF の多肢選択式試験に共通の記述').first().isVisible(), `${tag} 試験の数字に但し書きがある`);
  check((await page.getByRole('table').count()) === 4 && (await page.getByRole('cell', { name: 'Cloud Native Community and Collaboration' }).count()) === 1, `${tag} 学習要領の 4 分野の表と細目が出る`);
  check(await page.getByRole('link', { name: /Kubernetes の公式ドキュメント/ }).first().isVisible(), `${tag} 主な情報源に名前とリンクがある`);
  await noHorizontalOverflow(page, width, `${tag} 説明のページ`);

  // 14. 画面の色: 設定で選ぶと、端末の設定に関わらずその色になり、記録に残る
  await page.goto(`${BASE}settings/`);
  await page.getByRole('heading', { name: '設定' }).waitFor();
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const bgBefore = await bodyBg();
  await page.getByRole('radio', { name: 'ダーク' }).click();
  await page.waitForTimeout(200);
  const darkBg = await bodyBg();
  check(darkBg !== bgBefore && darkBg === 'rgb(17, 17, 18)', `${tag} ダークを選ぶと地が暗くなる (${bgBefore} → ${darkBg})`);
  await page.reload();
  await page.getByRole('heading', { name: '設定' }).waitFor();
  check((await bodyBg()) === 'rgb(17, 17, 18)', `${tag} 読み込み直してもダークのまま`);
  await page.getByRole('radio', { name: 'ライト' }).click();
  await page.waitForTimeout(200);
  check((await bodyBg()) === 'rgb(241, 244, 247)', `${tag} ライトを選ぶと地が明るくなる`);
  await page.getByRole('radio', { name: '端末に合わせる' }).click();
  const savedMode = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').profile?.colorMode);
  check(savedMode === undefined, `${tag} 端末に合わせるに戻すと記録から消える`);
  // 端末がダークのときにライトを選ぶ。ダイアログ (記録を消す) の地も選んだ色に従う
  {
    const darkCtx = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
    const dp = await darkCtx.newPage();
    dp.on('pageerror', (e) => errors.push(e.message));
    await dp.goto(`${BASE}settings/`);
    await dp.getByRole('heading', { name: '設定' }).waitFor();
    const bg = () => dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check((await bg()) === 'rgb(17, 17, 18)', `${tag} 端末がダークで何も選ばなければ暗い地`);
    await dp.getByRole('radio', { name: 'ライト' }).click();
    await dp.waitForTimeout(200);
    check((await bg()) === 'rgb(241, 244, 247)', `${tag} 端末がダークでもライトを選ぶと明るい地`);
    await dp.getByRole('button', { name: '記録を消す' }).click();
    const dlgBg = await dp.getByRole('alertdialog').evaluate((el) => getComputedStyle(el).backgroundColor);
    check(dlgBg === 'rgb(255, 255, 255)', `${tag} ライトを選ぶとダイアログも明るい (${dlgBg})`);
    await dp.getByRole('button', { name: 'やめる' }).click();
    // 読み込み直したとき、最初の描画から選んだ色 (index.html の小さな script)
    await dp.route('**/assets/*.js', (r) => r.abort());
    await dp.reload();
    const preJs = await dp.evaluate(() => document.documentElement.getAttribute('data-theme'));
    check(preJs === 'light', `${tag} JS が動く前から選んだ色が付いている (${preJs})`);
    await darkCtx.close();
  }

  // 15. ハンドブック: 目次の 13 トピックと範囲外の 13、1 トピックの流れ・試す手順・練習のレッスン、説明のページの学習要領から飛べる
  await page.goto(`${BASE}handbook/`);
  await page.getByRole('heading', { name: 'ハンドブック', level: 1 }).waitFor();
  check((await page.locator('.hb-topic').count()) === 26, `${tag} ハンドブックの目次に学習要領の 13 トピックと範囲外の 13`);
  const heads = await page.locator('.hb-domain__head').allInnerTexts();
  check(heads.slice(-5).every((h) => h.startsWith('範囲外: ') && /\d+ トピック/.test(h)) && heads.length === 9, `${tag} 範囲外は 5 つの段で目次の最後に並び、配点の代わりにトピックの数が出る`);
  // 範囲内と範囲外は別の部に分かれ、カードの札でも見分けられる
  const partOf = (name) => page.getByRole('region', { name, exact: true });
  check((await partOf('試験の範囲').locator('.hb-topic').count()) === 13 && (await partOf('範囲外: 一緒に知っておくと役立つこと').locator('.hb-topic').count()) === 13, `${tag} 目次は試験の範囲 13 と範囲外 13 の 2 部に分かれる`);
  check((await page.locator('.hb-topic .hb-scope--extra').count()) === 13 && (await page.locator('.hb-topic .hb-scope:not(.hb-scope--extra)').count()) === 13, `${tag} カードに試験の範囲か範囲外かの札が付く`);
  await page.getByRole('navigation', { name: 'ハンドブックの部' }).getByRole('link', { name: /範囲外/ }).click();
  await page.waitForTimeout(400);
  const partTop = await page.locator('#hb-part-extra').evaluate((el) => el.getBoundingClientRect().top);
  check(partTop >= 0 && partTop < 200, `${tag} 上の範囲外のリンクで範囲外の部へ飛ぶ (${Math.round(partTop)})`);
  // 飛んだ位置でカードを開いて戻ると、飛んだ位置に戻る (先頭へ戻さない)
  const hbScroller = () => page.evaluate(() => (document.querySelector('.astryx-layout-content') ?? document.scrollingElement).scrollTop);
  const jumped = await hbScroller();
  await page.locator('#hb-part-extra .hb-topic').first().click();
  await page.locator('#hb-title').waitFor();
  check((await page.locator('.hb-head .hb-scope').innerText()) === '範囲外', `${tag} 範囲外のトピックの頭に範囲外の札が付く`);
  await page.goBack();
  await page.locator('.hb-topic').first().waitFor();
  await page.waitForTimeout(800);
  check(Math.abs((await hbScroller()) - jumped) <= 2, `${tag} 部へ飛んでからカードを開いて戻ると、飛んだ位置に戻る (${jumped} → ${await hbScroller()})`);
  // 見出しの組み: 部が h2、段が h3
  check((await page.getByRole('heading', { level: 2, name: '試験の範囲', exact: true }).count()) === 1 && (await page.locator('.hb-domain__head').evaluateAll((els) => els.filter((e) => e.tagName === 'H3').length)) === 9, `${tag} 部は h2、段は h3 (9 個)`);
  await page.goto(`${BASE}handbook/`);
  await page.locator('.hb-topic').first().waitFor();
  check(await page.getByRole('region', { name: /範囲外: クラウド/ }).isVisible(), `${tag} 目次の段は、段の名前で読み上げられる`);
  check((await page.locator('.hb-topic .dg-thumb').count()) === 26, `${tag} 目次の 26 トピックすべてにサムネイルがある`);
  await page.locator('.hb-topic').filter({ hasText: 'Debugging' }).click();
  await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
  check(page.url().includes('/handbook/debugging/'), `${tag} 目次からトピックへ飛べる`);
  check((await page.locator('.hb-try').count()) >= 2 && (await page.locator('.hb-try[open]').count()) === 1, `${tag} 試す手順があり、最初の 1 つだけ開いている`);
  check((await page.locator('.sv__result').count()) >= 1, `${tag} 手順の絵に、起きる結果が添えられる`);
  check((await page.locator('.sv__row').count()) >= 10 && (await page.locator('.sv__row[aria-label^="作る"]').count()) >= 1, `${tag} 手順に、コマンドで起きることの絵が付く`);
  await page.locator('.gloss-chip').first().click();
  await page.waitForURL(/\/lesson\//);
  check(true, `${tag} ハンドブックから練習のレッスンへ飛べる`);
  await page.goto(`${BASE}guide/`);
  check(await page.getByRole('heading', { name: '学び方' }).isVisible(), `${tag} 説明のページに学び方が出る`);
  await page.getByRole('link', { name: 'Kubernetes Core Concepts' }).click();
  await page.waitForURL(/\/handbook\/core-concepts\//);
  check(true, `${tag} 説明のページの学習要領の表からハンドブックへ飛べる`);
  // 26 トピックすべてを、試す手順を全部開いた形で、横にはみ出さないか測る
  await page.goto(`${BASE}handbook/`);
  // 画面の部品は開いたときに読むので、目次のカードが出るまで待つ
  await page.locator('.hb-topic').first().waitFor();
  const allIds = await page.locator('.hb-topic').evaluateAll((els) => els.map((a) => a.getAttribute('href').split('/').filter(Boolean).pop()));
  let widest = { id: '', w: 0 };
  const figureMissing = [];
  const figureScroll = [];
  for (const id of allIds) {
    await page.goto(`${BASE}handbook/${id}/`);
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if ((await page.locator('figure.dg figcaption').count()) !== 1) figureMissing.push(id);
    const figOverflow = await page.locator('.dg__scroll').evaluate((el) => el.scrollWidth - el.clientWidth);
    if (figOverflow > 1) figureScroll.push(`${id}:${figOverflow}`);
    if (w > widest.w) widest = { id, w };
  }
  check(figureScroll.length === 0, `${tag} 図が横にスクロールせず幅に収まる ${figureScroll.join(',')}`);
  check(figureMissing.length === 0, `${tag} ハンドブックの 26 トピックすべてに図がある ${figureMissing.join(',')}`);
  check(allIds.length === 26 && widest.w <= width, `${tag} ハンドブックの 26 トピックが横にはみ出さない (いちばん広い ${widest.id} ${widest.w} <= ${width})`);

  // 15c. ハンドブックの読んだ記録: 流れの段を画面に出すと記録され、目次に読みかけ、続きから・確認済みが使える
  {
    const hb = () => page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').handbook ?? {});
    await page.goto(`${BASE}handbook/storage/`);
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    const steps = await page.locator('[data-flow-step]').count();
    await page.waitForTimeout(300);
    // 画面の外のコードは軽い表示で先に出し (最初の描画を止めない)、画面に近づくと CodeBlock (色分け・コピー) に替わる
    const lazyBefore = await page.locator('[data-lazy-code]').count();
    const blocksBefore = await page.locator('.hb-step .astryx-code-block').count();
    check(lazyBefore >= 3 && blocksBefore < lazyBefore, `${tag} 開いた直後、画面の外のハンドブックのコードは軽い表示 (CodeBlock ${blocksBefore}・軽い表示 ${lazyBefore})`);
    // 軽い表示と CodeBlock は同じ高さ (替わるときに位置がずれない)。いちばん下の段の軽い表示の高さを覚え、最後の段まで出したあとに比べる
    const lastLazy = await page.locator('.hb-flow > li[data-flow-step]:has([data-lazy-code])').last().getAttribute('data-flow-step');
    const lastCode = page.locator(`li[data-flow-step="${lastLazy}"] .hb-step`).first().locator(':scope > :is(.code-lite, .astryx-code-block)').first();
    const liteH = await lastCode.evaluate((el) => el.getBoundingClientRect().height);
    check(((await hb()).storage?.seen ?? 0) < steps, `${tag} 開いた直後は全部を読んだことにならない`);
    await page.locator('[data-flow-step="2"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('[data-flow-step="2"]').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    const seen = (await hb()).storage?.seen ?? 0;
    check(seen >= 3, `${tag} 流れの段を画面に出すと、何段目まで読んだかが記録される (${seen})`);
    await page.goto(`${BASE}#/handbook`);
    const card = page.locator('a.hb-topic', { has: page.locator('.hb-topic__en', { hasText: 'Storage' }) });
    check(/読みかけ \d+ \/ \d+ 段/.test(await card.locator('.hb-topic__read').innerText()), `${tag} 目次のカードに読みかけと段の数が出る`);
    await card.click();
    await page.getByRole('button', { name: '続きから' }).click();
    // なめらかなスクロールが止まるまで待つ (決まった時間ではなく、位置が落ち着くまで)
    const stepTop = (n) => page.locator(`[data-flow-step="${n}"]`).evaluate((el) => el.getBoundingClientRect().top - (document.querySelector('.astryx-layout-content')?.getBoundingClientRect().top ?? 0));
    await page.waitForFunction((n) => { const el = document.querySelector(`[data-flow-step="${n}"]`); const t = el.getBoundingClientRect().top - (document.querySelector('.astryx-layout-content')?.getBoundingClientRect().top ?? 0); return Math.abs(t) < 60; }, seen, { timeout: 5000 }).catch(() => {});
    const top = await stepTop(seen);
    check(Math.abs(top) < 60, `${tag} 続きからで、前回の続きの段が画面の上に来る (${Math.round(top)})`);
    await page.locator(`[data-flow-step="${steps - 1}"]`).scrollIntoViewIfNeeded();
    await page.evaluate((n) => document.querySelector(`[data-flow-step="${n}"]`).scrollIntoView({ block: 'start' }), steps - 1);
    await page.waitForTimeout(400);
    check((await hb()).storage?.seen === steps, `${tag} 最後の段まで出すと、全部の段を読んだことになる (${steps})`);
    check((await page.locator('.hb-flow [data-lazy-code]').evaluateAll((els) => els.filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length)) === 0 && (await page.locator('.hb-step .astryx-code-block').count()) > blocksBefore, `${tag} 画面に入ったコードは CodeBlock に替わる`);
    const blockH = await lastCode.evaluate((el) => (el.classList.contains('astryx-code-block') ? el.getBoundingClientRect().height : -1)).catch(() => -1);
    const blockH2 = blockH > 0 ? blockH : await page.locator(`li[data-flow-step="${lastLazy}"] .hb-step .astryx-code-block`).first().evaluate((el) => el.getBoundingClientRect().height);
    check(Math.abs(blockH2 - liteH) <= 1, `${tag} 軽い表示と CodeBlock の高さが同じ (${liteH.toFixed(1)} → ${blockH2.toFixed(1)})`);
    const toggle = page.getByRole('button', { name: '確認済みにする' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '確認済みを取り消す' }).waitFor();
    check(await page.evaluate(() => document.activeElement?.textContent?.includes('確認済みを取り消す')), `${tag} 確認済みにしてもフォーカスはボタンに残る`);
    check((await hb()).storage?.done === true, `${tag} 確認済みにすると記録に残る`);
    await page.goto(`${BASE}#/handbook`);
    check((await card.locator('.hb-topic__read').innerText()) === '確認済み' && (await page.getByRole('navigation', { name: 'ハンドブックの部' }).getByText(/13 トピック · 確認済み 1/).isVisible()), `${tag} 目次に確認済みと、確認済みの数が出る`);
  }

  // 15b. ハンドブックの本文の用語: 強調され、押すと用語集のその語が開く
  {
    await page.goto(`${BASE}handbook/core-concepts/`);
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    const terms = page.locator('a.hb-term');
    check((await terms.count()) >= 10, `${tag} ハンドブックの本文の用語集の語がリンクになる (${await terms.count()} 語)`);
    const weight = await terms.first().evaluate((el) => getComputedStyle(el).fontWeight);
    check(Number(weight) >= 600, `${tag} 用語のリンクは太字で強調される (${weight})`);
    const etcd = page.locator('a.hb-term', { hasText: /^etcd$/ });
    await etcd.first().click();
    await page.waitForURL(/\/glossary\/etcd\/$/);
    // 押した語の 1 語のページが開く (h1 は語の名前。書き出す HTML と同じ)
    const termTitle = page.locator('#gloss-term-title');
    await termTitle.waitFor();
    check((await termTitle.innerText()).trim() === 'etcd' && (await page.locator('h1').count()) === 1, `${tag} 用語の 1 語のページが開き、h1 は語の名前 (etcd)`);
    check((await page.locator('#gloss-term .gloss-detail__more').count()) >= 2 && (await page.locator('#gloss-term a.gloss-term').count()) >= 1, `${tag} 用語集の語に詳しい説明が出て、中のほかの語がリンクになる`);
    check(JSON.stringify(await page.locator('nav[aria-label="パンくず"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) === JSON.stringify(['/kcna-dojo/', '/kcna-dojo/glossary/']), `${tag} 用語のページのパンくずはトップ・用語集の順`);
    // 説明の中のリンクを押すと、その語のページに替わる
    const linked = page.locator('#gloss-term a.gloss-term').first();
    const linkedText = (await linked.innerText()).trim();
    await linked.click();
    await page.waitForFunction(() => document.querySelector('#gloss-term-title')?.textContent?.trim() !== 'etcd', null, { timeout: 5000 }).catch(() => {});
    check((await termTitle.innerText()).trim() !== 'etcd', `${tag} 説明の中のリンクを押すと、その語のページに替わる (${linkedText} → ${(await termTitle.innerText()).trim()})`);
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('#gloss-term-title')?.textContent?.trim() === 'etcd', null, { timeout: 5000 }).catch(() => {});
    const ai = await page.locator('#gloss-term').getByRole('link', { name: 'Claude' }).getAttribute('href');
    check(ai.startsWith('https://claude.ai/new?q=') && decodeURIComponent(ai.split('?q=')[1]).includes('「etcd」'), `${tag} 用語集の語から、語を入れた AI を開ける`);
    // 用語の図: 見ている語の箱だけを主役の色にする。図は画面の幅に収まる
    const fig = page.locator('#gloss-term .gloss-detail__figure');
    check(await fig.locator('svg').isVisible(), `${tag} 用語集の語に図が出る`);
    const lit = await fig.locator('.dg__node--current').evaluateAll((els) => els.map((el) => el.parentElement.querySelector('.dg__label')?.textContent));
    check(lit.length >= 1 && lit.every((t) => t === 'etcd'), `${tag} 図では見ている語 (etcd) の箱が強調される (${lit.join('・')})`);
    const figW = await fig.locator('svg').evaluate((el) => el.getBoundingClientRect().width);
    check(figW > 0 && figW <= page.viewportSize().width, `${tag} 用語の図は画面の幅に収まる (${Math.round(figW)}px)`);
    await noHorizontalOverflow(page, width, `${tag} 用語のページ`);
    if (width < 768) {
      // 一覧で開いた語から、その語のページへ行ける
      await page.goto(`${BASE}glossary/`);
      await page.locator('#gloss-row-etcd button[aria-expanded]').click();
      check((await page.locator('#gloss-row-etcd a.gloss-page-link').getAttribute('href')) === '/kcna-dojo/glossary/etcd/', `${tag} 一覧で開いた語から、その語のページへのリンクがある`);
      // 戻る・進むで来たときは、覚えた位置に戻す
      const scrollTop = () => page.evaluate(() => (document.querySelector('.astryx-layout-content') ?? document.scrollingElement).scrollTop);
      await page.evaluate(() => ((document.querySelector('.astryx-layout-content') ?? document.scrollingElement).scrollTop = 1500));
      await page.waitForTimeout(200);
      const saved = await scrollTop();
      await page.goto(`${BASE}about/`);
      await page.goBack();
      await page.waitForTimeout(600);
      check(Math.abs((await scrollTop()) - saved) <= 2, `${tag} 用語集へ戻ると覚えた位置 (${saved} → ${await scrollTop()})`);
    }
  }

  // 15c. 似た語の比較表: 一覧から表を開き、列の語から用語集へ、用語集から表へ行き来できる
  {
    await page.goto(`${BASE}compare/`);
    await page.locator('.cmp-card').first().waitFor();
    check((await page.locator('.cmp-card').count()) >= 10, `${tag} 比較表の一覧に表が並ぶ (${await page.locator('.cmp-card').count()})`);
    await page.locator('.cmp-card', { hasText: 'StatefulSet' }).first().click();
    await page.locator('.cmp-table').waitFor();
    const cols = await page.locator('.cmp-table thead th').count();
    const rowCells = await page.locator('.cmp-table tbody tr').first().locator('td').count();
    check(cols - 1 === rowCells && rowCells >= 2, `${tag} 比較表は列と行のセルの数がそろう (${rowCells} 列)`);
    check((await page.locator('.cmp-pitfalls li').count()) >= 1 && (await page.locator('.cmp-section pre, .cmp-section code').count()) >= 1, `${tag} 比較表に取り違えやすい点とコードがある`);
    await noHorizontalOverflow(page, width, `${tag} 比較表`);
    // サイトの中で表へ移ると、題名が表の題名になり、ハンドブックのデータは読まない
    const loaded = [];
    const onReq = (r) => loaded.push(r.url());
    page.on('request', onReq);
    await page.goto(`${BASE}compare/`);
    await page.locator('.cmp-card').nth(1).click();
    await page.locator('.cmp-table').waitFor();
    await page.waitForTimeout(500);
    page.off('request', onReq);
    check((await page.title()) === 'Service の 4 つの type の違い | クラネイ' && !loaded.some((u) => /\/handbook-[^/]*\.js$/.test(u)), `${tag} 比較表へ移ると題名が表の題名になり、ハンドブックのデータは読まない (${await page.title()})`);
    await page.goto(`${BASE}glossary/deployment/`);
    await page.getByRole('heading', { name: '似た語と比べる' }).first().waitFor({ timeout: 5000 }).catch(() => {});
    check((await page.locator('a.gloss-chip[href*="/compare/"]').count()) >= 1, `${tag} 用語集の語から、その語の比較表へ飛べる`);
  }

  // 15d. コマンドのページ: 一覧から開き、中で何が起きるか・API の要求・実行の例・実装を読むが出る。答えたあとの説明から飛べる
  {
    await page.goto(`${BASE}commands/`);
    await page.locator('.cmdp-row').first().waitFor();
    check((await page.locator('.cmdp-row').count()) >= 50, `${tag} コマンドの一覧に並ぶ (${await page.locator('.cmdp-row').count()})`);
    await page.locator('.cmdp-row', { hasText: 'kubectl get' }).first().click();
    await page.locator('.cmdp-inside').waitFor();
    check((await page.locator('.cmdp-inside li').count()) >= 3, `${tag} コマンドのページに中で何が起きるかの段がある`);
    check((await page.locator('.cmdp-api tbody tr').count()) >= 1 && (await page.locator('a[href^="https://github.com/kubernetes/kubectl/blob/"]').count()) >= 1, `${tag} コマンドのページに API の要求と実装へのリンクがある`);
    check((await page.title()) === 'kubectl get | クラネイ', `${tag} コマンドのページの題名 (${await page.title()})`);
    await noHorizontalOverflow(page, width, `${tag} コマンドのページ`);
    // スマホでは全部のページの横のはみ出しを見る (長い API のパスなど、ページごとに中身が違うため)
    if (width < 768) {
      const ids = readdirSync(new URL('../src/content/commandPages/', import.meta.url)).flatMap((f) => JSON.parse(readFileSync(new URL(`../src/content/commandPages/${f}`, import.meta.url), 'utf8')).map((p) => p.id));
      const wide = [];
      for (const id of ids) {
        await page.goto(`${BASE}commands/${id}/`);
        await page.locator('.cmdp-inside').waitFor();
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        if (sw > width) wide.push(`${id}:${sw}`);
      }
      check(wide.length === 0, `${tag} コマンドのページ ${ids.length} ページとも横にはみ出さない ${wide.join(' ')}`);
    }
    await page.goto(`${BASE}lesson/w1-l3/`);
    await page.getByRole('textbox', { name: '空欄' }).fill('get');
    await page.getByRole('textbox', { name: '空欄' }).press('Enter');
    await page.locator('.cmd-notes').waitFor();
    await page.locator('.cmd-notes a[href*="/commands/kubectl-get/"]').click();
    await page.locator('.cmdp-inside').waitFor({ timeout: 5000 }).catch(() => {});
    check(page.url().endsWith('/commands/kubectl-get/'), `${tag} 答えたあとの説明から、そのコマンドのページへ飛べる`);
  }

  // 16. 戻る操作: 目次を下まで送ってトピックを開き、戻ると元の位置。新しく開いたページは先頭
  {
    const scrollTop = () => page.evaluate(() => (document.querySelector('.astryx-layout-content') ?? document.scrollingElement).scrollTop);
    const scrollTo = (y) => page.evaluate((v) => ((document.querySelector('.astryx-layout-content') ?? document.scrollingElement).scrollTop = v), y);
    await page.goto(`${BASE}handbook/`);
    await page.locator('.hb-topic').first().waitFor();
    // 人が見えているカードを押すのと同じく、カードを画面に入れてから押す (押す直前の位置を覚えているか)
    const card = page.locator('.hb-topic').nth(6);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const before = await scrollTop();
    await card.click();
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    await page.waitForTimeout(300);
    check((await scrollTop()) < 5, `${tag} 新しく開いたトピックは先頭から (${await scrollTop()})`);
    await page.goBack();
    await page.locator('.hb-topic').first().waitFor();
    await page.waitForTimeout(600);
    const after = await scrollTop();
    check(before > 100 && Math.abs(after - before) < 5, `${tag} 戻ると目次の元の位置 (${before} → ${after})`);
    // 進むと、トピックを送った位置に戻る
    await page.goForward();
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    await page.waitForTimeout(600);
    check((await scrollTop()) < 5, `${tag} 進むとトピックの離れた位置 (先頭) に戻る (${await scrollTop()})`);
    await scrollTo(500);
    await page.waitForTimeout(200);
    await page.goBack();
    await page.locator('.hb-topic').first().waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    await page.waitForTimeout(600);
    const fwd = await scrollTop();
    check(Math.abs(fwd - 500) < 5, `${tag} トピックを 500 まで送って戻り、進むと 500 (${fwd})`);
  }

  // 17. 検索に載る作り: # の無い URL で直接開ける・書き出した HTML に題名と本文がある・前の形の #/ は新しい URL へ・中のリンクは読み直さない
  {
    const res = await fetch(`${BASE}handbook/core-concepts/`);
    const html = await res.text();
    check(res.status === 200 && /<title>Kubernetes の中心の考え方 \| クラネイ/.test(html) && html.includes('<link rel="canonical" href="https://maco165.github.io/kcna-dojo/handbook/core-concepts/"') && html.includes('<h1>Kubernetes の中心の考え方</h1>'), `${tag} ハンドブックのトピックを直接開くと 200 で、書き出した HTML に題名・canonical・本文がある`);
    const personal = await (await fetch(`${BASE}progress/`)).text();
    check(personal.includes('<meta name="robots" content="noindex"'), `${tag} 個人の記録の画面は検索に載せない (noindex)`);
    const map = await (await fetch(`${BASE}sitemap.xml`)).text();
    check(map.includes('/kcna-dojo/handbook/core-concepts/</loc>') && map.includes('/kcna-dojo/glossary/</loc>') && !map.includes('/progress/'), `${tag} sitemap にハンドブックと用語集があり、個人の画面は無い`);
    // コマンドのページ: 書き出した HTML に中で何が起きるか・API の要求・実装の抜粋まで入り、sitemap に載る
    const cmdHtml = await (await fetch(`${BASE}commands/kubectl-get/`)).text();
    check(cmdHtml.includes('<h2>中で何が起きるか</h2>') && cmdHtml.includes('/api/v1/namespaces/{namespace}/pods') && cmdHtml.includes('github.com/kubernetes/kubectl/blob/') && map.includes('/kcna-dojo/commands/kubectl-get/</loc>'), `${tag} コマンドのページは書き出した HTML に中身と実装まであり、sitemap に載る`);
    // 比較表: 書き出した HTML に表まで入り、sitemap に載る
    const cmpHtml = await (await fetch(`${BASE}compare/workloads/`)).text();
    check(cmpHtml.includes('<table>') && cmpHtml.includes('<h2>取り違えやすい点</h2>') && map.includes('/kcna-dojo/compare/workloads/</loc>'), `${tag} 比較表のページは書き出した HTML に表まであり、sitemap に載る`);
    await page.goto(`${BASE}handbook/storage/`);
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    check(new URL(page.url()).pathname === '/kcna-dojo/handbook/storage/' && !page.url().includes('#'), `${tag} 前の形の #/... の URL は、同じページの新しい URL になる (${page.url()})`);
    await page.evaluate(() => (window.__noReload = true));
    await page.locator('a[href="/kcna-dojo/handbook/"]').first().click();
    await page.getByRole('heading', { name: 'ハンドブック', level: 1 }).waitFor();
    check((await page.evaluate(() => window.__noReload)) === true, `${tag} サイトの中のリンクは、ページを読み直さずに切り替わる`);
    check((await page.title()).startsWith('ハンドブック | クラネイ'), `${tag} サイトの中で移ると、題名もそのページのものになる (${await page.title()})`);
    await page.goBack();
    await page.getByRole('heading', { name: '全体の流れ' }).waitFor();
    check(new URL(page.url()).pathname === '/kcna-dojo/handbook/storage/', `${tag} 戻るで前のページに戻る`);
    // パンくず: 画面 (JS が描いたあと) にも、書き出した HTML (BreadcrumbList) と同じ階層で、トップから出る
    const crumbHrefs = () => page.locator('nav[aria-label="パンくず"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    check(JSON.stringify(await crumbHrefs()) === JSON.stringify(['/kcna-dojo/', '/kcna-dojo/handbook/']), `${tag} ハンドブックのトピックのパンくずはトップ・ハンドブックの順 (${await crumbHrefs()})`);
    for (const [p, name] of [['glossary/', '用語集'], ['week/2/', 'クラスタの構成']]) {
      await page.goto(`${BASE}${p}`);
      await page.getByRole('heading', { name, level: 1 }).first().waitFor();
      // 書き出した HTML のパンくずではなく、画面が描いたパンくずを見る (React が #root を置き換えるまで待つ)
      await page.waitForFunction(() => !document.querySelector('#root > main.prerender'));
      const current = await page.locator('nav[aria-label="パンくず"] [aria-current="page"]').first().textContent();
      check(JSON.stringify(await crumbHrefs()) === JSON.stringify(['/kcna-dojo/']) && current.includes(name), `${tag} ${p} のパンくずはトップから出る (${await crumbHrefs()} / ${current})`);
    }
  }

  // 描画後の h1 は、書き出した HTML の h1 と同じ (ホームはサイト名、週は「第 n 週 …」、レッスンはレッスン名、用語のページは語の名前)。h1 は 1 つだけ
  for (const p of ['', 'week/1/', 'week/2/', 'lesson/w2-l1/', 'glossary/etcd/']) {
    const html = await (await fetch(`${BASE}${p}`)).text();
    const written = html.match(/<h1>([^<]*)<\/h1>/)?.[1].replace(/&amp;/g, '&') ?? '(無し)';
    await page.goto(`${BASE}${p}`);
    await page.waitForFunction(() => !document.querySelector('#root > main.prerender') && !document.querySelector('#root > main[style]'));
    await page.locator('h1, h2').first().waitFor();
    const shown = (await page.locator('h1').allInnerTexts()).map((t) => t.trim());
    check(shown.length === 1 && shown[0] === written, `${tag} /${p} の描画後の h1 は書き出した h1 と同じ (${written} / ${shown.join(' · ')})`);
    if (p.startsWith('lesson/')) check((await page.getByRole('heading', { level: 2 }).first().innerText()).length > 10, `${tag} レッスンの問題文は h2`);
  }

  // 後から読むチャンクを読めない (新しい版を出したあとの開いたままのタブなど) ときも白紙にしない。
  // 別のページで調べ、ここで出るエラーは上のエラーの検査に入れない
  {
    const bp = await context.newPage();
    const rootText = () => bp.evaluate(() => document.getElementById('root')?.innerText.trim().length ?? 0);
    // 答えたあとの部品 (読み直す先・出てきたコマンド) が 404 でも、レッスンの画面は残り、次へ進める
    await bp.route(/\/assets\/(ReadMore|CommandNotes)-[^/]+\.js$/, (r) => r.fulfill({ status: 404, body: '' }));
    await bp.goto(`${BASE}lesson/${l1.id}/`);
    await bp.waitForFunction(() => !document.querySelector('#root > main.prerender'));
    const q = l1.questions[0];
    await bp.getByRole('radio', { name: choiceLabel(q, q.answer) }).check();
    await bp.getByRole('button', { name: '確かめる' }).click();
    await bp.waitForTimeout(1000);
    check((await rootText()) > 100 && (await bp.getByRole('button', { name: /次へ|結果を見る/ }).count()) >= 1, `${tag} 答えたあとの部品のチャンクが 404 でも白紙にならず、次へ進める (${await rootText()} 字)`);
    // ホームを開いたあとレッスンの画面と問題の全文のチャンクが 404 になっても、白紙にしない (読み直して書き出した HTML を出す)
    let block = false;
    await bp.unrouteAll();
    await bp.route(/\/assets\/(LessonRoute|LessonScreen|lessons)-[^/]+\.js$/, (r) => (block ? r.fulfill({ status: 404, body: '' }) : r.continue()));
    await bp.goto(BASE);
    await bp.waitForFunction(() => !document.querySelector('#root > main.prerender'));
    block = true;
    await bp.locator(`a[href="/kcna-dojo/lesson/${l1.id}/"]`).first().click();
    await bp.waitForTimeout(2000);
    check((await rootText()) > 100, `${tag} レッスンの画面のチャンクが 404 でも白紙にならない (${await rootText()} 字)`);
    await bp.close();
  }

  check(errors.length === 0, `${tag} ページのエラーが無い ${errors.length ? errors.join(' / ') : ''}`);
  await context.close();
}

// npx の子の vite まで止められるよう、別のプロセスグループで立てる
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
// 自分のサーバーが立たなかったとき (番号が埋まっているなど)、残っている別のサーバーにつないで偽の結果を出さないよう止める
let serverExited = false;
server.on('exit', () => (serverExited = true));
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  checkFirstLoad();
  checkSpeedBuild();
  checkOgImages();
  await run(browser, 'phone', 390, 844);
  await run(browser, 'pc', 1280, 860);
  await checkStudyFeatures(browser, 390);
  await checkStudyFeatures(browser, 1280);
} catch (e) {
  console.log(`FAIL 実行中に止まりました: ${e.message}`);
  failures++;
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid);
  } catch {
    server.kill();
  }
}
console.log(failures === 0 ? 'e2e OK' : `e2e NG (${failures} 件)`);
process.exit(failures === 0 ? 0 : 1);
