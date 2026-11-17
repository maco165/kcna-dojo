import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_NAME } from '../src/lib/site';

// SNS の共有と検索のための index.html の head の中身。SNS の読み手は JavaScript を動かさないので、静的な HTML に要る
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');
const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? '';
const SITE_URL = 'https://maco165.github.io/kcna-dojo/';

describe('index.html の head', () => {
  it('題・説明・正規の URL がある', () => {
    expect(doc.title.startsWith(SITE_NAME)).toBe(true);
    expect(meta('meta[name="description"]').length).toBeGreaterThan(50);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(SITE_URL);
  });

  it('OGP と X のカードがそろい、画像は絶対の URL', () => {
    expect(meta('meta[property="og:title"]').startsWith(SITE_NAME)).toBe(true);
    expect(meta('meta[property="og:site_name"]')).toBe(SITE_NAME);
    expect(meta('meta[property="og:description"]')).toBe(meta('meta[name="description"]'));
    expect(meta('meta[property="og:url"]')).toBe(SITE_URL);
    expect(meta('meta[property="og:image"]')).toBe(`${SITE_URL}og-image.png`);
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(meta('meta[name="twitter:image"]')).toBe(`${SITE_URL}og-image.png`);
  });

  it('共有の画像が 1200×630 の PNG で置いてある', () => {
    const png = readFileSync(join(__dirname, '../public/og-image.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it('JSON-LD が読めて、サイト名と URL が合う', () => {
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}');
    expect(ld['@type']).toBe('WebSite');
    expect(ld.name).toBe(SITE_NAME);
    expect(ld.url).toBe(SITE_URL);
  });

  it('JavaScript を動かさない読み手にも見出しと説明がある', () => {
    expect(doc.querySelector('#root h1')?.textContent).toContain(SITE_NAME);
  });
});
