import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
// @ts-expect-error 書き出しの手順は JS (scripts/*.mjs)
import { buildPages, isIndexed, renderPage } from '../scripts/prerender.mjs';
// @ts-expect-error 同上
import { OG_HEIGHT, OG_WIDTH, kickerOf, loadFonts, missingGlyphs, ogFileName, ogSvg, ogText, palettePng, renderPng, wrapText } from '../scripts/og-images.mjs';
import { Resvg } from '@resvg/resvg-js';

type Page = { path: string; title: string; heading?: string; description: string };
type Font = { getAdvanceWidth: (s: string, size: number) => number };
let pages: Page[];
let fonts: { bold: Font; regular: Font };

beforeAll(async () => {
  pages = (await buildPages((m: string) => import(/* @vite-ignore */ path.join(process.cwd(), m)))).filter(isIndexed);
  fonts = await loadFonts();
}, 120_000);

/** PNG の塊を読む (IHDR の幅・高さ・色の型と、IDAT をほどいた画素の列) */
function readPng(buf: Buffer) {
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let at = 8;
  const chunks: Record<string, Buffer[]> = {};
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    (chunks[type] ??= []).push(buf.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const ihdr = chunks.IHDR[0];
  return { width: ihdr.readUInt32BE(0), height: ihdr.readUInt32BE(4), colorType: ihdr[9], plte: chunks.PLTE?.[0], data: chunks.IDAT ? inflateSync(Buffer.concat(chunks.IDAT)) : undefined };
}

describe('ページごとの OG 画像', () => {
  it('検索に載るすべてのページの題名・札・説明の文字が字体にある (字形の欠けが無い)', () => {
    const lack = pages.flatMap((p) => {
      const t = ogText(p);
      const m = [...missingGlyphs(fonts.bold, t.title), ...missingGlyphs(fonts.regular, t.kicker + t.description)];
      return m.length ? [`${p.path}: ${m.join(' ')}`] : [];
    });
    expect(lack).toEqual([]);
    expect(pages.length).toBeGreaterThan(200);
  });

  it('字体に無い文字は見つける (検査が働く)', () => {
    expect(missingGlyphs(fonts.bold, 'Pod\u{1FAE0}と\u{E000}')).toEqual(['\u{1FAE0}', '\u{E000}']);
  });

  it('画像の名前はページごとに違う', () => {
    const names = pages.map((p) => ogFileName(p.path));
    expect(new Set(names).size).toBe(names.length);
    expect(ogFileName('handbook/core-concepts/')).toBe('handbook-core-concepts.png');
  });

  it('種類の札', () => {
    expect(['handbook/x/', 'glossary/x/', 'commands/x/', 'compare/x/', 'lesson/w1-l1/', 'week/2/', 'exam/', 'about/'].map((p) => kickerOf({ path: p }))).toEqual(['ハンドブック', '用語集', 'コマンド', '似た語の比較表', 'レッスン', '週のレッスン', '模擬試験', 'KCNA-JP 対策']);
  });

  it('行は幅に収め、行の頭に句読点を置かず、あふれたら … で終える', () => {
    const width = 400;
    const lines: string[] = wrapText(fonts.regular, 'コントロールプレーンは、クラスタ全体の状態を etcd に置き、kube-scheduler が Pod の置き場所を決めます。', 28, width, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(fonts.regular.getAdvanceWidth(l, 28)).toBeLessThanOrEqual(width * 1.04);
    expect(lines.slice(1).some((l) => /^[、。]/.test(l))).toBe(false);
    expect(lines.join('')).not.toMatch(/kube-sch$|^eduler/m);
    expect(lines.at(-1)).toMatch(/…$/);
    expect(wrapText(fonts.regular, '短い', 28, width, 2)).toEqual(['短い']);
  });

  it('いちばん長い題名も 3 行に収まる (… で切らない)', () => {
    const longest = [...pages].sort((a, b) => ogText(b).title.length - ogText(a).title.length)[0];
    const svg: string = ogSvg(fonts, ogText(longest));
    expect(svg).not.toContain('<text');
    for (const size of [64]) expect(wrapText(fonts.bold, ogText(longest).title, size, OG_WIDTH - 160, 3).at(-1)).not.toMatch(/…$/);
  });

  it('1200×630 の PNG で、パレットにしても resvg の絵と画素が同じ', () => {
    const svg: string = ogSvg(fonts, ogText(pages.find((p) => p.path === 'handbook/core-concepts/')!));
    const png: Buffer = renderPng(svg);
    const r = readPng(png);
    expect([r.width, r.height]).toEqual([OG_WIDTH, OG_HEIGHT]);
    expect(r.colorType).toBe(3);
    const img = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
    const px = img.pixels;
    let diff = 0;
    for (let y = 0; y < OG_HEIGHT; y++)
      for (let x = 0; x < OG_WIDTH; x++) {
        const n = r.data![y * (OG_WIDTH + 1) + 1 + x];
        const i = (y * OG_WIDTH + x) * 4;
        if (r.plte![n * 3] !== px[i] || r.plte![n * 3 + 1] !== px[i + 1] || r.plte![n * 3 + 2] !== px[i + 2]) diff++;
      }
    expect(diff).toBe(0);
    expect(png.length).toBeLessThan(40_000);
  });

  it('色が多い・透明があるときはパレットにしない', () => {
    // 画素ごとに違う色 (400 色)
    const many = new Uint8Array(20 * 20 * 4).map((_, i) => (i % 4 === 3 ? 255 : i % 4 === 0 ? (i >> 2) & 255 : i % 4 === 1 ? (i >> 10) & 255 : 0));
    expect(palettePng(many, 20, 20)).toBeNull();
    expect(palettePng(new Uint8Array(4 * 4 * 4), 4, 4)).toBeNull();
  });

  it('og:image・twitter:image・og:image:alt をそのページの画像にし、無いページはサイト共通の画像のまま', () => {
    const template = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const img = 'https://maco165.github.io/kcna-dojo/og/glossary-etcd.png';
    const html: string = renderPage(template, { path: 'glossary/etcd/', title: 'etcd', description: 'd', body: '', ogImage: img, ogAlt: 'etcd — クラネイ' });
    expect(html).toContain(`<meta property="og:image" content="${img}"`);
    expect(html).toContain(`<meta name="twitter:image" content="${img}"`);
    expect(html).toContain('<meta property="og:image:alt" content="etcd — クラネイ"');
    const plain: string = renderPage(template, { path: 'progress/', title: '進捗', description: 'd', body: '', noindex: true });
    expect(plain).toContain('<meta property="og:image" content="https://maco165.github.io/kcna-dojo/og-image.png"');
    expect(plain).toContain('<meta name="twitter:image" content="https://maco165.github.io/kcna-dojo/og-image.png"');
  });
});
