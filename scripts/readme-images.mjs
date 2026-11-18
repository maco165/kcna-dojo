#!/usr/bin/env node
// README の画像を作り直す: npm run readme:images
// - public/og-image.png: SNS で URL を共有したときの画像 (1200×630、OGP と X のカード)
// - docs/images/banner-light.png / banner-dark.png: 見出しの画像。色と字体はアプリと同じ Astryx のトークン (src/themes/kcna/kcna.css の値)
// - docs/images/*.png: 組み立てた dist を vite preview で配り、見本の進捗を入れた状態で撮った画面
// 画面を変えたら走らせ直し、画像も同じ PR でコミットする。
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const OUT = new URL('../docs/images/', import.meta.url).pathname;
const PORT = 4319;
const BASE = `http://localhost:${PORT}/kcna-dojo/`;
mkdirSync(OUT, { recursive: true });

// Astryx の core の既定のトークンの写し (npm run astryx -- docs tokens/tokens-color の light / dark)
const TOKENS = {
  light: { body: '#F1F4F7', surface: '#FFFFFF', text: '#0A1317', sub: '#4E606F', border: '#05365919', strong: '#CCD3DB', accent: '#0064E0', success: '#0D8626', successText: '#09441F', successMuted: '#0B991F33' },
  dark: { body: '#111112', surface: '#1F1F22', text: '#DFE2E5', sub: '#AAAFB5', border: '#F2F4F619', strong: '#494D53', accent: '#0171E3', success: '#0D8626', successText: '#A5F690', successMuted: '#0B991F3F' },
};

function bannerHtml(t, { width = 1280, height = 360, pad = 72, zoom = 1, lead = 'コマンドと YAML の穴埋め・4 択を、週ごとのレッスンで。<br>進捗はブラウザの中だけに残ります。' } = {}) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; width: ${width}px; height: ${height}px; background: ${t.body}; color: ${t.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", sans-serif; }
  .wrap { display: flex; gap: 56px; align-items: center; height: ${height / zoom}px; padding: 0 ${pad}px; zoom: ${zoom}; }
  .lead { flex: 1 1 0; display: flex; flex-direction: column; gap: 12px; }
  .eyebrow { font-size: 17px; color: ${t.sub}; }
  h1 { margin: 0; font-size: 56px; font-weight: 600; letter-spacing: -0.01em; }
  .brand { display: flex; align-items: center; gap: 16px; }
  p { margin: 0; font-size: 20px; line-height: 1.6; color: ${t.sub}; }
  .card { flex: 0 0 480px; background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 12px; overflow: hidden; }
  .bar { padding: 8px 16px; border-bottom: 1px solid ${t.border}; font-size: 13px; color: ${t.sub}; }
  .code { padding: 20px 16px; font-family: "SF Mono", Monaco, Consolas, monospace; font-size: 17px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .blank { border: 1px solid ${t.success}; border-radius: 4px; padding: 2px 10px; }
  .ok { margin: 0 16px 16px; padding: 12px 14px; border-radius: 12px; background: ${t.successMuted}; color: ${t.successText}; font-size: 15px; font-weight: 600; }
  .rows { border-top: 1px solid ${t.border}; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; font-size: 15px; border-bottom: 1px solid ${t.border}; }
  .row:last-child { border-bottom: 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .row span:last-child { margin-left: auto; color: ${t.sub}; font-size: 13px; }
</style></head><body><div class="wrap">
  <div class="lead">
    <div class="eyebrow">KCNA-JP 対策 · 非公式の学習サイト</div>
    <div class="brand"><svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="${t.accent}"/><path d="M17 20l12 12-12 12" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 44h13" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/></svg><h1>クラネイ</h1></div>
    <p>${lead}</p>
  </div>
  <div class="card">
    <div class="bar">bash</div>
    <div class="code"><span style="color:${t.sub}">$</span> kubectl <span class="blank">get</span> pods -n kube-system -o wide</div>
    <div class="ok">正解</div>
    <div class="rows">
      <div class="row"><span class="dot" style="background:${t.success}"></span>コンテナと VM<span>完了</span></div>
      <div class="row"><span class="dot" style="background:${t.accent}"></span>OCI と CRI<span>次</span></div>
    </div>
  </div>
</div></body></html>`;
}

/** 見本の進捗: 2 レッスン完了、今日 27 XP、3 日連続 */
function seedProgress() {
  const d = new Date();
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = key(d);
  const ago = (n) => key(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n));
  const progress = {
    v: 1,
    streak: { count: 3, lastDay: today },
    xp: { total: 66, byDay: { [ago(5)]: 12, [ago(4)]: 30, [ago(2)]: 9, [ago(1)]: 18, [today]: 27 } },
    lessons: {
      'w1-l1': { done: true, best: 0.8, at: d.toISOString() },
      'w1-l2': { done: true, best: 1, at: d.toISOString() },
    },
    // 復習の画面に今日の 2 問を出す
    answers: {
      'w1-l1-q1': { right: 0, wrong: 1, last: ago(1), stage: 0, nextReview: today },
      'w1-l2-q4': { right: 1, wrong: 1, last: ago(1), stage: 0, nextReview: today },
      'w1-l1-q2': { right: 1, wrong: 0, last: ago(1) },
    },
    exams: [{ at: new Date(d.getTime() - 86400000).toISOString(), correct: 41, total: 60 }],
  };
  localStorage.setItem('kcna.v1', JSON.stringify(progress));
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
  throw new Error('vite preview が応えません');
}

const browser = await chromium.launch();
// npx の子の vite まで止められるよう、別のプロセスグループで立てる
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
// 自分のサーバーが立たなかったとき (番号が埋まっているなど)、残っている別のサーバーにつないで偽の結果を出さないよう止める
let serverExited = false;
server.on('exit', () => (serverExited = true));
try {
  for (const mode of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 360 }, deviceScaleFactor: 2 });
    await page.setContent(bannerHtml(TOKENS[mode]), { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}banner-${mode}.png` });
    await page.close();
  }

  // SNS の共有の画像 (明るい側だけ。OGP の推奨の 1200×630)
  {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(bannerHtml(TOKENS.light, { width: 1200, height: 630, pad: 40, zoom: 1.3, lead: 'コマンドと YAML の穴埋めと<br>4 択を、週ごとのレッスンで。' }), { waitUntil: 'networkidle' });
    await page.screenshot({ path: new URL('../public/og-image.png', import.meta.url).pathname });
    await page.close();
  }

  await waitForServer();
  const shoot = async (name, { width, height }, url, act) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: 'light' });
    await context.addInitScript(seedProgress);
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    if (act) await act(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}${name}.png` });
    await context.close();
  };
  const phone = { width: 390, height: 844 };
  await shoot('home-pc', { width: 1280, height: 800 }, BASE);
  await shoot('home-phone', phone, BASE);
  await shoot('fill-phone', phone, `${BASE}#/lesson/w1-l3`, async (page) => {
    const input = page.getByRole('textbox', { name: '空欄' });
    await input.fill('get');
    await input.press('Enter');
  });
  await shoot('choice-phone', phone, `${BASE}#/lesson/w1-l4`, async (page) => {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '確かめる' }).click();
  });
  await shoot('review-phone', phone, `${BASE}#/review`);
  await shoot('progress-phone', phone, `${BASE}#/progress`);
  await shoot('exam-phone', phone, `${BASE}#/exam`, async (page) => {
    await page.getByRole('button', { name: /^第 \d+ 回を始める$/ }).click();
    await page.getByRole('radio').first().check().catch(() => {});
  });
  await shoot('glossary-phone', phone, `${BASE}#/glossary`, async (page) => {
    await page.getByRole('searchbox', { name: '用語を探す' }).fill('Pod');
    await page.locator('.gloss-row__head').first().click();
  });
  await shoot('settings-phone', phone, `${BASE}#/settings`);
  console.log(`書き出した: ${OUT}`);
} finally {
  await browser.close();
  try {
    process.kill(-server.pid);
  } catch {
    server.kill();
  }
}
