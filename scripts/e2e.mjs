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
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

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
  const lessonLinks = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#/lesson/"]')].map((a) => a.getAttribute('href')))]);
  check(lessonLinks.length === week1.lessons.length, `${tag} 空の記録でも全部のレッスンを開ける (${lessonLinks.length} / ${week1.lessons.length})`);
  check((await startLinks.count()) === 1, `${tag} ホームの「開始」は 1 つだけ`);
  check((await startLinks.first().getAttribute('href')) === `#/lesson/${l1.id}`, `${tag} 「開始」は最初のレッスン`);
  check(await page.getByText('0 / 30 XP').isVisible(), `${tag} 今日の目標は 0 / 30 XP`);
  check((await page.title()).startsWith('クラネイ'), `${tag} ページの題がクラネイで始まる`);
  check(await page.getByText('クラネイ', { exact: true }).first().isVisible(), `${tag} サイト名クラネイが出る`);
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
      // 「正しくは X」の記号が、画面の並びでの正解の位置と合う
      const answerLabel = (await page.getByText(choiceLabel(q, q.answer)).first().textContent()) ?? '';
      const answerLetter = answerLabel.trim().slice(0, 1);
      check(/^[A-D]$/.test(answerLetter) && (await page.getByText(`不正解 · 正しくは ${answerLetter}`).isVisible()), `${tag} 「正しくは ${answerLetter}」が画面の並びと合う`);
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
  await page.getByRole('heading', { name: 'コンテナの基礎' }).waitFor();
  const xp = (total - 1) * 3;
  const doneText = width >= 768 ? `${total - 1} / ${total}` : '完了';
  check(await page.getByText(doneText, { exact: true }).first().isVisible(), `${tag} 1 つ目が完了になる (${doneText})`);
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

  // 4a. 答えたあと、AI に聞くリンクの上の Enter では進まず、それ以外の Enter で次へ進む
  await page.getByRole('link', { name: 'Claude' }).focus();
  const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 5000 }).catch(() => null), page.keyboard.press('Enter')]);
  await popup?.close();
  check(await page.getByText(`${l3.title} · 1 / ${l3.questions.length} 問`).isVisible(), `${tag} AI のリンクの上の Enter では次へ進まない`);
  await page.locator('body').focus();
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press('Enter');
  check(await page.getByText(`${l3.title} · 2 / ${l3.questions.length} 問`).isVisible(), `${tag} 答えたあと Enter で次へ進む`);
  await page.goto(`${BASE}#/lesson/w1-l3`);
  await page.reload();
  await page.getByRole('textbox', { name: '空欄' }).fill('get');
  await page.getByRole('textbox', { name: '空欄' }).press('Enter');

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
  check(await page.getByText(`${l1.title} · 1 / ${l1.questions.length} 問`).isVisible(), `${tag} やり直すと 1 問目から始まる`);

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

  // 9. このサイトについて と リポジトリへのリンク
  await page.goto(BASE);
  const repoLinks = page.locator('a[href="https://github.com/maco165/kcna-dojo"]');
  check((await repoLinks.count()) >= 1, `${tag} ホームにリポジトリへのリンクがある`);
  await page.goto(`${BASE}#/about`);
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
  await page.goto(`${BASE}#/review`);
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

  // 9c. 進捗の画面
  await page.goto(`${BASE}#/progress`);
  await page.getByRole('heading', { name: '進捗' }).waitFor();
  check(await page.getByText('分野ごとの正答率').isVisible() && await page.getByText('この 7 日の XP').isVisible(), `${tag} 進捗の画面に正答率と 7 日の XP が出る`);
  check((await page.getByRole('link', { name: /第 1 週 コンテナの基礎/ }).count()) === 1, `${tag} 進捗の画面に週ごとの進み具合が出る`);
  check(await page.getByRole('img', { name: /今日 \d+ XP$/ }).isVisible(), `${tag} 7 日の XP の名前の最後が今日`);
  check(await page.getByText(/^(これから|予定どおり|\d+ レッスン遅れ)/).first().isVisible(), `${tag} 計画との差が出る`);
  await noHorizontalOverflow(page, width, `${tag} 進捗`);

  // 10. 設定: 目標を変える・書き出す・読み込む・記録を消す
  await page.goto(`${BASE}#/settings`);
  await page.getByRole('heading', { name: '設定' }).waitFor();
  await page.getByRole('radio', { name: '10 XP' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(saved?.profile?.dailyGoalXp === 10, `${tag} 1 日の目標を 10 XP にすると記録に残る`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '記録を書き出す (JSON)' }).click()]);
  check(/^kcna-progress-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), `${tag} 記録を書き出すと日付入りの JSON が保存される`);
  const exported = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
  check(exported.v === 1 && exported.profile?.dailyGoalXp === 10, `${tag} 書き出した中身が今の記録と同じ`);
  await page.getByRole('button', { name: '記録を消す' }).click();
  await page.getByRole('button', { name: '消す', exact: true }).click();
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
  await page.goto(`${BASE}#/exam`);
  await page.getByRole('heading', { name: '模擬試験' }).waitFor();
  const answersBefore = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').answers ?? {}).length);
  await page.getByRole('button', { name: '模擬試験を始める' }).click();
  check(await page.getByText(/模擬試験 · 1 \/ 60 問/).isVisible(), `${tag} 模擬試験は 60 問`);
  check(await page.getByText(/残り (90:00|89:5\d)/).isVisible(), `${tag} 残り時間が 90 分から始まる`);
  const firstRadio = page.getByRole('radio').first();
  if (await firstRadio.count()) await firstRadio.check();
  else await page.getByRole('textbox', { name: '空欄' }).fill('x');
  await page.getByRole('button', { name: '次へ' }).click();
  check(await page.getByText(/模擬試験 · 2 \/ 60 問 · 答えた 1/).isVisible(), `${tag} 次へで 2 問目に進み、答えた数が数えられる`);
  await page.getByRole('button', { name: '採点する' }).first().click();
  check(await page.getByText(/まだ答えていない問題が 59 問あります/).isVisible(), `${tag} 採点の前に答えていない数を知らせる`);
  await page.getByRole('button', { name: '採点する' }).last().click();
  await page.getByRole('heading', { name: '結果' }).waitFor();
  const afterExam = await page.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? 'null'));
  check(afterExam?.exams?.length === 1 && afterExam.exams[0].total === 60, `${tag} 模擬試験の結果が記録に残る`);
  const answersAdded = Object.keys(afterExam?.answers ?? {}).length - answersBefore;
  check(answersAdded <= 1, `${tag} 答えなしの問題は記録しない (増えた記録 ${answersAdded})`);
  await noHorizontalOverflow(page, width, `${tag} 模擬試験の結果`);
  await page.getByRole('button', { name: '模擬試験の最初へ戻る' }).click();
  // やめるときは確かめる
  await page.getByRole('button', { name: '模擬試験を始める' }).click();
  await page.getByRole('button', { name: '模擬試験をやめる' }).click();
  check(await page.getByText('ここまでの答えは残らず').isVisible(), `${tag} 模擬試験をやめる前に確かめる`);
  await page.getByRole('button', { name: '続ける' }).click();
  check(await page.getByText(/模擬試験 · 1 \/ 60 問/).isVisible(), `${tag} 続けるを選ぶと試験に戻る`);
  await page.getByRole('button', { name: '模擬試験をやめる' }).click();
  await page.getByRole('button', { name: 'やめる', exact: true }).click();
  await page.getByRole('button', { name: '模擬試験を始める' }).waitFor();
  check(await page.getByText(/ \/ 60 \(\d+%\)/).first().isVisible(), `${tag} 模擬試験の画面にこれまでの結果が出る`);
  await page.goto(`${BASE}#/progress`);
  await page.getByRole('heading', { name: '進捗' }).waitFor();
  check(await page.getByText(/前回 \d+ \/ 60 問/).isVisible(), `${tag} 進捗の画面に模擬試験の前回の結果が出る`);

  // 13. 模擬試験の時間切れ: 時計を 90 分進めると自動で採点する
  {
    const tp = await context.newPage();
    tp.on('pageerror', (e) => errors.push(e.message));
    await tp.clock.install();
    await tp.goto(`${BASE}#/exam`);
    const before = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    await tp.getByRole('button', { name: '模擬試験を始める' }).click();
    await tp.clock.fastForward('01:30:02');
    await tp.getByRole('heading', { name: '結果' }).waitFor();
    await tp.clock.fastForward('00:00:10');
    const after = await tp.evaluate(() => JSON.parse(localStorage.getItem('kcna.v1') ?? '{}').exams?.length ?? 0);
    check(after === before + 1, `${tag} 時間切れで 1 回だけ自動で採点する (${before} → ${after})`);
    await tp.close();
  }

  // 12. 用語集: 検索とレッスンへのリンク
  await page.goto(`${BASE}#/glossary`);
  await page.getByRole('heading', { name: '用語集', level: 1 }).waitFor();
  check((await page.locator('article.gloss').count()) >= 70, `${tag} 用語集に 70 語以上ある`);
  await page.getByRole('searchbox', { name: '用語を探す' }).fill('ｋｕｂｅｌｅｔ');
  check(await page.getByRole('heading', { name: 'kubelet', level: 2 }).isVisible(), `${tag} 全角で探しても kubelet が見つかる`);
  await page.getByRole('searchbox', { name: '用語を探す' }).fill('存在しない語ですzzz');
  check(await page.getByText('見つかりませんでした').isVisible(), `${tag} 見つからないときに知らせる`);
  await page.getByRole('searchbox', { name: '用語を探す' }).fill('etcd');
  await page.locator('article.gloss').first().getByRole('link', { name: /^第 \d+ 週/ }).first().click();
  await page.waitForURL(/#\/lesson\//);
  check(page.url().includes('#/lesson/'), `${tag} 用語集からレッスンへ飛べる`);
  await page.goto(`${BASE}#/glossary`);
  await noHorizontalOverflow(page, width, `${tag} 用語集`);

  // 13. 説明のページ: 見本の問題を解ける・数字が問題データと合う・左の一覧/ホームから入れる
  await page.goto(BASE);
  await page.getByRole('link', { name: /Kubernetes とこのサイト/ }).first().click();
  await page.getByRole('heading', { name: /問題を解きながら根っこから/, level: 1 }).waitFor();
  check(page.url().includes('#/guide'), `${tag} ホーム (左の一覧) から説明のページへ入れる`);
  await page.getByRole('button', { name: 'describe', exact: true }).click();
  check(await page.getByText('describe は違います').isVisible(), `${tag} 見本の問題で違う候補を選ぶと違うと出る`);
  await page.getByRole('button', { name: 'get', exact: true }).click();
  check(await page.getByText(/^正解。/).isVisible(), `${tag} 見本の問題で get を選ぶと正解と出る`);
  check(await page.getByLabel('このサイトの中身').getByText('228').isVisible(), `${tag} 説明のページの問題の数が問題データと合う`);
  check(await page.getByText('LF の多肢選択式試験に共通の記述').first().isVisible(), `${tag} 試験の数字に但し書きがある`);
  await noHorizontalOverflow(page, width, `${tag} 説明のページ`);

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
  await run(browser, 'phone', 390, 844);
  await run(browser, 'pc', 1280, 860);
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
