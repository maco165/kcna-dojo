// 書き出すとき (scripts/prerender.mjs の最後) に、検索に載る各ページの題名入りの OG 画像 (1200×630 の PNG) を dist/og/ に作る。
// 字体は npm の Noto Sans JP (@expo-google-fonts/noto-sans-jp の TTF。SIL Open Font License) を opentype.js で読み、
// 文字を形 (path) にした SVG を resvg で PNG にする。ブラウザも OS の字体も使わないので、CI (ubuntu の node だけ) でも
// 手元でも同じ絵になる。描く前に、描くすべての文字が字体にあることを確かめ、無ければ止める (字形の欠けを出さない)。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';

const require = createRequire(import.meta.url);
const FONT_DIR = path.dirname(require.resolve('@expo-google-fonts/noto-sans-jp/package.json'));
export const FONT_FILES = {
  bold: path.join(FONT_DIR, '700Bold/NotoSansJP_700Bold.ttf'),
  regular: path.join(FONT_DIR, '400Regular/NotoSansJP_400Regular.ttf'),
};

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** 画像を置く場所 (dist の下) */
export const OG_DIR = 'og';
const MARGIN = 80;
const TEXT_WIDTH = OG_WIDTH - MARGIN * 2;
/** 色はサイト共通の og-image.png と同じ (Astryx の明るい側の値) */
const COLOR = { bg: '#F1F4F7', card: '#FFFFFF', border: '#CCD3DB', text: '#0A1317', sub: '#4E606F', accent: '#0064E0' };
const SITE_HOST = 'maco165.github.io/kcna-dojo';

/** ページの道 (handbook/core-concepts/) から画像の名前 (handbook-core-concepts.png) */
export const ogFileName = (p) => `${p.replace(/\/+$/, '').replace(/\//g, '-') || 'top'}.png`;

/** ページの種類の札 (画像の左上、サイト名の下) */
export function kickerOf(page) {
  const p = page.path;
  if (p.startsWith('handbook/')) return 'ハンドブック';
  if (p.startsWith('glossary/')) return '用語集';
  if (p.startsWith('commands/')) return 'コマンド';
  if (p.startsWith('compare/')) return '似た語の比較表';
  if (p.startsWith('hands-on/') || page.parent === 'hands-on/') return '実践';
  if (p.startsWith('lesson/')) return 'レッスン';
  if (p.startsWith('week/')) return '週のレッスン';
  if (p === 'exam/') return '模擬試験';
  return 'KCNA-JP 対策';
}

export async function loadFonts() {
  const parse = async (f) => opentype.parse((await readFile(f)).buffer.slice(0));
  return { bold: await parse(FONT_FILES.bold), regular: await parse(FONT_FILES.regular) };
}

/** 字体に無い文字 (空白と改行は除く)。字体に無い文字は豆腐の四角になるので、1 つでもあれば描かない */
export function missingGlyphs(font, text) {
  return [...new Set([...text].filter((ch) => !/\s/.test(ch) && font.charToGlyphIndex(ch) === 0))];
}

/** 行の頭に来てはいけない文字 (句読点・閉じ括弧など) */
const NO_START = /^[、。，．,.)）」』】〉》・ー…:;!?！？%]/;

/** 英数字の語はまとめ、日本語は 1 文字ずつ、空白は 1 つの区切りにする */
function tokens(text) {
  return text.match(/[A-Za-z0-9_.\-/:+#@'"&]+|\s+|./gu) ?? [];
}

/**
 * 幅に収まるよう行に分ける。maxLines を超える分は最後の行を … で終える。
 * 語の途中では切らない (1 語だけで幅を超えるときは文字で切る)。行の頭の句読点は前の行に付ける
 */
export function wrapText(font, text, size, width, maxLines) {
  const w = (s) => font.getAdvanceWidth(s, size);
  const lines = [];
  let cur = '';
  for (const tok of tokens(text.replace(/\s+/g, ' ').trim())) {
    const next = cur + tok;
    if (w(next) <= width || cur === '' || (NO_START.test(tok) && w(next) <= width * 1.04)) {
      if (cur === '' && w(tok) > width) {
        // 1 語で幅を超える: 文字で切る
        for (const ch of tok) {
          if (w(cur + ch) > width && cur) {
            lines.push(cur);
            cur = '';
          }
          cur += ch;
        }
      } else cur = next;
      continue;
    }
    lines.push(cur.trimEnd());
    cur = tok.trim() === '' ? '' : tok;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && w(`${last}…`) > width) last = [...last].slice(0, -1).join('');
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** 題名の大きさ: 3 行に収まる最大 (64 → 56 → 48) */
export function titleLayout(font, title) {
  for (const size of [64, 56, 48]) {
    const lines = wrapText(font, title, size, TEXT_WIDTH, 3);
    if (!lines.at(-1).endsWith('…')) return { size, lines };
  }
  return { size: 48, lines: wrapText(font, title, 48, TEXT_WIDTH, 3) };
}

const pathOf = (font, text, x, y, size) => font.getPath(text, x, y, size).toPathData(1);

/** 1 ページ分の SVG (文字はすべて path) */
export function ogSvg(fonts, { kicker, title, description }) {
  const t = titleLayout(fonts.bold, title);
  const desc = wrapText(fonts.regular, description, 28, TEXT_WIDTH, 2);
  const parts = [];
  const text = (font, s, x, y, size, fill) => parts.push(`<path d="${pathOf(font, s, x, y, size)}" fill="${fill}"/>`);
  // 上: ロゴ (favicon.svg と同じ絵) とサイト名、種類の札
  parts.push(`<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLOR.bg}"/>`);
  parts.push(`<rect x="40" y="40" width="${OG_WIDTH - 80}" height="${OG_HEIGHT - 80}" rx="24" fill="${COLOR.card}" stroke="${COLOR.border}" stroke-width="2"/>`);
  parts.push(`<g transform="translate(${MARGIN} 80) scale(0.875)"><rect width="64" height="64" rx="14" fill="${COLOR.accent}"/><path d="M17 20l12 12-12 12" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 44h13" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/></g>`);
  text(fonts.bold, 'クラネイ', MARGIN + 72, 122, 34, COLOR.text);
  const kw = fonts.regular.getAdvanceWidth(kicker, 26);
  parts.push(`<rect x="${OG_WIDTH - MARGIN - kw - 32}" y="84" width="${kw + 32}" height="48" rx="24" fill="#E5EFFC"/>`);
  text(fonts.regular, kicker, OG_WIDTH - MARGIN - kw - 16, 117, 26, '#0A4FB0');
  // 真ん中: 題名 (3 行まで) と説明 (2 行まで)
  const lineH = Math.round(t.size * 1.3);
  const descH = desc.length * 42;
  const blockH = t.lines.length * lineH + (desc.length ? 24 + descH : 0);
  let y = Math.round(180 + (330 - blockH) / 2 + t.size * 0.9);
  for (const l of t.lines) {
    text(fonts.bold, l, MARGIN, y, t.size, COLOR.text);
    y += lineH;
  }
  y += 24 - lineH + 42;
  for (const l of desc) {
    text(fonts.regular, l, MARGIN, y, 28, COLOR.sub);
    y += 42;
  }
  // 下: サイトの URL
  parts.push(`<rect x="${MARGIN}" y="${OG_HEIGHT - 128}" width="${TEXT_WIDTH}" height="2" fill="${COLOR.border}"/>`);
  text(fonts.regular, SITE_HOST, MARGIN, OG_HEIGHT - 82, 24, COLOR.sub);
  const tag = 'KCNA-JP 対策の非公式の学習サイト';
  text(fonts.regular, tag, OG_WIDTH - MARGIN - fonts.regular.getAdvanceWidth(tag, 24), OG_HEIGHT - 82, 24, COLOR.sub);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">${parts.join('')}</svg>`;
}

/** 画像に描く文 */
export const ogText = (page) => ({ kicker: kickerOf(page), title: page.heading ?? page.title, description: page.description });

/**
 * PNG にする。絵は数色 (地・文字・強調と、その間のなめらかな縁) なので、色が 256 以下ならパレットの PNG
 * (色を落とさない。同じ絵のまま半分以下の大きさ) にし、超えたら resvg の PNG のまま
 */
export function renderPng(svg) {
  const img = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
  return palettePng(img.pixels, img.width, img.height) ?? img.asPng();
}

/** RGBA の画素を、色が 256 以下ならパレット (color type 3) の PNG にする。透明が混じる・色が多いときは null */
export function palettePng(rgba, width, height, level = 6) {
  const index = new Map();
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // 行ごとのフィルタ: なし
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] !== 255) return null;
      const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      let n = index.get(key);
      if (n === undefined) {
        if (index.size === 256) return null;
        n = index.size;
        index.set(key, n);
      }
      raw[y * (width + 1) + 1 + x] = n;
    }
  }
  const plte = Buffer.alloc(index.size * 3);
  for (const [key, n] of index) plte.writeUIntBE(key, n * 3, 3);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 3, 0, 0, 0], 8); // 8 bit・パレット・圧縮 0・フィルタ 0・インターレースなし
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', deflateSync(raw, { level })), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * pages (検索に載るページ) の画像を distDir/og/ に書き、ページの道 → 画像の名前を返す。
 * 描く文字が字体に無ければ、どのページのどの文字かを出して止める
 */
export async function writeOgImages(pages, distDir) {
  const fonts = await loadFonts();
  const missing = [];
  for (const page of pages) {
    const t = ogText(page);
    const lack = [...missingGlyphs(fonts.bold, t.title), ...missingGlyphs(fonts.regular, `${t.kicker}${t.description}`)];
    if (lack.length) missing.push(`${page.path}: ${lack.join(' ')}`);
  }
  if (missing.length) throw new Error(`og-images: 字体に無い文字があります (描くと欠ける)\n${missing.join('\n')}`);
  await mkdir(path.join(distDir, OG_DIR), { recursive: true });
  const out = new Map();
  let bytes = 0;
  for (const page of pages) {
    const png = renderPng(ogSvg(fonts, ogText(page)));
    const name = ogFileName(page.path);
    await writeFile(path.join(distDir, OG_DIR, name), png);
    bytes += png.length;
    out.set(page.path, name);
  }
  return { files: out, bytes };
}
