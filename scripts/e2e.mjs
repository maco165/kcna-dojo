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
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 4318;
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
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
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

const choiceLabel = (q, choiceId) => {
  const i = q.choices.findIndex((c) => c.id === choiceId);
  return `${String.fromCharCode(65 + i)}. ${q.choices[i].text}`;
};

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
  check((await startLinks.count()) === 1, `${tag} ホームの「開始」は 1 つだけ`);
  check((await startLinks.first().getAttribute('href')) === `#/lesson/${l1.id}`, `${tag} 「開始」は最初のレッスン`);
  check(await page.getByText('0 / 30 XP').isVisible(), `${tag} 今日の目標は 0 / 30 XP`);
  await noHorizontalOverflow(page, width, `${tag} ホーム`);

  // 2. 4 択のレッスンを解く (1 問目は不正解、残りは正解)
  await startLinks.first().click();
  for (const [i, q] of l1.questions.entries()) {
    const wrong = q.choices.find((c) => c.id !== q.answer).id;
    const pick = i === 0 ? wrong : q.answer;
    await page.getByRole('radio', { name: choiceLabel(q, pick) }).check();
    await page.getByRole('button', { name: '確かめる' }).click();
    if (i === 0) {
      check(await page.getByText('不正解 · 正しくは').isVisible(), `${tag} 不正解のとき知らせが出る`);
      check(await page.getByText(q.explanation).isVisible(), `${tag} 不正解のとき解説が出る`);
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

  // 3. ホームへ戻る
  await page.getByRole('link', { name: '一覧へ戻る' }).click();
  await page.getByRole('heading', { name: 'レッスン' }).waitFor();
  const xp = (total - 1) * 3;
  check(await page.getByText(`完了 · 最高 ${Math.round(((total - 1) / total) * 100)}%`).isVisible(), `${tag} 1 つ目が完了になる`);
  check(
    (await page.getByRole('link', { name: '開始' }).first().getAttribute('href')) === `#/lesson/${l2.id}`,
    `${tag} 「開始」が 2 つ目に移る`,
  );
  check(await page.getByText(`${xp} / 30 XP`).isVisible(), `${tag} 今日の目標が ${xp} XP に増える`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(stored?.lessons?.[l1.id]?.done === true && stored?.streak?.count === 1, `${tag} localStorage の kcna.v1 に完了と連続 1 日が残る`);

  // 4. コマンドの穴埋め (打ち込んで Enter)
  await page.goto(`${BASE}#/lesson/w1-l3`);
  const input = page.getByRole('textbox', { name: '空欄' });
  await input.fill('get');
  await input.press('Enter');
  check(await page.getByText('正解', { exact: true }).isVisible(), `${tag} 穴埋めを Enter で確かめると正解`);
  check(await page.getByText('実行結果の例').isVisible(), `${tag} 正解のあと実行結果の例が出る`);
  await noHorizontalOverflow(page, width, `${tag} 穴埋め`);

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
  await page.goto(`${BASE}#/lesson/w1-l1`);
  const before = new URL(await page.getByRole('link', { name: 'Claude' }).getAttribute('href')).searchParams.get('q') ?? '';
  check(before.includes(l1.questions[0].prompt) && !before.includes('正解は'), `${tag} 答える前のリンクには正解を入れない`);

  // 5. もう一度解く (全問を最初の選択肢で答え、数え直しを確かめる)
  for (const [i] of l1.questions.entries()) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '確かめる' }).click();
    await page.getByRole('button', { name: i === l1.questions.length - 1 ? '結果を見る' : '次へ' }).click();
  }
  await page.getByRole('button', { name: 'もう一度解く' }).click();
  check(await page.getByText(`${l1.title} · 1 / ${l1.questions.length}`).isVisible(), `${tag} もう一度解くと 1 問目から始まる`);

  // 6. 実習
  await page.goto(`${BASE}#/lesson/${lab.id}`);
  const finish = page.getByRole('button', { name: '完了にする' });
  check(await finish.isDisabled(), `${tag} 実習は印を付けるまで完了にできない`);
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await finish.click();
  await page.getByRole('heading', { name: 'レッスン完了' }).waitFor();
  const labStored = await page.evaluate((id) => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null')?.lessons?.[id]?.done, lab.id);
  check(labStored === true, `${tag} 実習を全部の印で完了にすると記録が残る`);
  await noHorizontalOverflow(page, width, `${tag} 実習の完了`);

  check(errors.length === 0, `${tag} ページのエラーが無い ${errors.length ? errors.join(' / ') : ''}`);
  await context.close();
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  await run(browser, 'phone', 390, 844);
  await run(browser, 'pc', 1280, 860);
} catch (e) {
  console.log(`FAIL 実行中に止まりました: ${e.message}`);
  failures++;
} finally {
  await browser?.close();
  server.kill();
}
console.log(failures === 0 ? 'e2e OK' : `e2e NG (${failures} 件)`);
process.exit(failures === 0 ? 0 : 1);
