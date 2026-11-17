#!/usr/bin/env node
// README の画像を作り直す: npm run readme:images
// - docs/images/banner-light.png / banner-dark.png: 見出しの画像。色と字体はアプリと同じ Astryx のトークン (src/themes/kcna/kcna.css の値)
// - docs/images/*.png: 組み立てた dist を vite preview で配り、見本の進捗を入れた状態で撮った画面
// 画面を変えたら走らせ直し、画像も同じ PR でコミットする。
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const OUT = new URL('../docs/images/', import.meta.url).pathname;
const PORT = 4319;
const BASE = `http://localhost:${PORT}/kcna-dojo/`;
mkdirSync(OUT, { recursive: true });

// kcna.css の light-dark() の値の写し (theme-neutral + 強調の青)
const TOKENS = {
  light: { body: '#f1f1f1', surface: '#ffffff', text: '#000000', sub: '#474747', border: '#00000014', strong: '#d4d4d4', accent: '#0064E0', success: '#2f7d33', successMuted: '#bce0bb' },
  dark: { body: '#1b1b1b', surface: '#262626', text: '#ffffff', sub: '#9e9e9e', border: '#ffffff1A', strong: '#525252', accent: '#0171E3', success: '#90ca90', successMuted: '#90ca903D' },
};

function bannerHtml(t) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&display=swap">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; width: 1280px; height: 360px; background: ${t.body}; color: ${t.text};
    font-family: Figtree, -apple-system, "Segoe UI", Roboto, "Noto Sans CJK JP", "Noto Sans JP", sans-serif; }
  .wrap { display: flex; gap: 56px; align-items: center; height: 100%; padding: 0 72px; }
  .lead { flex: 1 1 0; display: flex; flex-direction: column; gap: 12px; }
  .eyebrow { font-size: 17px; color: ${t.sub}; }
  h1 { margin: 0; font-size: 56px; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0; font-size: 20px; line-height: 1.6; color: ${t.sub}; }
  .card { flex: 0 0 520px; background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 12px; overflow: hidden; }
  .bar { padding: 8px 16px; border-bottom: 1px solid ${t.border}; font-size: 13px; color: ${t.sub}; }
  .code { padding: 20px 16px; font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 17px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .blank { border: 1px solid ${t.success}; border-radius: 4px; padding: 2px 10px; }
  .ok { margin: 0 16px 16px; padding: 12px 14px; border-radius: 12px; background: ${t.successMuted}; color: ${t.success}; font-size: 15px; font-weight: 600; }
  .rows { border-top: 1px solid ${t.border}; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; font-size: 15px; border-bottom: 1px solid ${t.border}; }
  .row:last-child { border-bottom: 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .row span:last-child { margin-left: auto; color: ${t.sub}; font-size: 13px; }
</style></head><body><div class="wrap">
  <div class="lead">
    <div class="eyebrow">KCNA-JP の学習サイト</div>
    <h1>kcna-dojo</h1>
    <p>コマンドと YAML の穴埋め・4 択を、週ごとのレッスンで。<br>進捗はブラウザの中だけに残ります。</p>
  </div>
  <div class="card">
    <div class="bar">bash</div>
    <div class="code"><span style="color:${t.sub}">$</span> kubectl <span class="blank">get</span> pods -n kube-system -o wide</div>
    <div class="ok">正解</div>
    <div class="rows">
      <div class="row"><span class="dot" style="background:${t.success}"></span>コンテナと VM<span>完了 · 最高 80%</span></div>
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
  const progress = {
    v: 1,
    streak: { count: 3, lastDay: today },
    xp: { total: 66, byDay: { [today]: 27 } },
    lessons: {
      'w1-l1': { done: true, best: 0.8, at: d.toISOString() },
      'w1-l2': { done: true, best: 1, at: d.toISOString() },
    },
    answers: {},
  };
  localStorage.setItem('kcna.v1', JSON.stringify(progress));
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // 立ち上がるまで待つ
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('vite preview が応えません');
}

const browser = await chromium.launch();
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
try {
  for (const mode of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 360 }, deviceScaleFactor: 2 });
    await page.setContent(bannerHtml(TOKENS[mode]), { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}banner-${mode}.png` });
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
  console.log(`書き出した: ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
