#!/usr/bin/env node
// public/favicon.svg から PNG のファビコンを作る: node scripts/favicons.mjs
// favicon.svg を直したら走らせ直し、PNG も一緒にコミットする。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const dir = new URL('../public/', import.meta.url).pathname;
const svg = readFileSync(`${dir}favicon.svg`, 'utf8');
// apple-touch-icon は iOS が角を丸めるので、角丸なしの四角で塗る
const square = svg.replace('rx="14"', 'rx="0"');

const browser = await chromium.launch();
for (const [name, size, src] of [
  ['favicon-32.png', 32, svg],
  ['apple-touch-icon.png', 180, square],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: `${dir}${name}`, omitBackground: true });
  await page.close();
  console.log(`書き出した: public/${name}`);
}
await browser.close();
